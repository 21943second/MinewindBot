import dotenv from "dotenv";
import process from "node:process";
import { createClient } from "redis";
import z from "zod";
import { MinecraftBot } from "./bot/MinecraftBot";
import { Ban } from "./commands/Ban";
import { ChatType, Platform } from "./commands/Command";
import { CommandManagerBuilder } from "./commands/CommandManager";
import { Help } from "./commands/Help";
import { Players } from "./commands/Players";
import { PriceCheck } from "./commands/PriceCheck";
import { Upcoming } from "./commands/Upcoming";
import { Verifier } from "./commands/Verifier";
import { DiscordBot } from "./discord/DiscordBot";
import { EventChannel, Users } from "./discord/servers";
import { Injest } from "./influx/injest";
import logger from "./Logger";
import {
	AbyssalEvent,
	AttackOnGiantEvent,
	BaitEvent,
	BeefEvent,
	CastleEvent,
	ChatEvent,
	DeathEvent,
	DebugEvent,
	FoxEvent,
	FreeForAllEvent,
	LabyrinthEvent,
	SharpeningEvent,
	SnovasionEvent,
	SystemEvent,
	TeamDeathMatchEvent,
	VoteEvent,
	WelcomeEvent,
} from "./MessageEvent";
import { MostRecentEvent } from "./MostRecentEvent";
import { breakLinks, getRandomInt, manualSend, pingUser } from "./util";

dotenv.config();

const chatStreamSchema = z
	.array(
		z.object({
			name: z.string(),
			messages: z.array(
				z.object({
					id: z.string(),
					message: z.object({
						message: z.string(),
					}),
				}),
			),
		}),
	)
	.length(1);

const DCToMWChatStreamSchema = z
	.array(
		z.object({
			name: z.string(),
			messages: z
				.array(
					z.object({
						id: z.string(),
						message: z.object({
							message: z.string(),
							proposed_nickname: z.string().optional(),
						}),
					}),
				)
				.length(1),
		}),
	)
	.length(1);

async function main() {
	// TODO: Add auto reconnection logic with exponential backoff
	const minecraftBot = new MinecraftBot();
	const discordBot = new DiscordBot();
	//const essencePriceChecker = new EssencePriceChecker();

	const client = await createClient({
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
		socket: {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
		},
	})
		.on("error", (err) => {
			logger.error("Redis Client Error", err);
			process.exit(1);
		})
		.connect();

	const mostRecentEvent = new MostRecentEvent(client);
	await mostRecentEvent.init();

	const verificationManager = new CommandManagerBuilder()
		.addCommand(new Verifier(minecraftBot, discordBot), [Platform.discord])
		.build();
	const commandManager = new CommandManagerBuilder()
		.addCommand(new Help(), [Platform.discord, Platform.minecraft])
		.addCommand(new PriceCheck(), [Platform.discord, Platform.minecraft])
		.addCommand(new Upcoming(minecraftBot, mostRecentEvent), [
			Platform.discord,
			Platform.minecraft,
		])
		.addCommand(new Players(minecraftBot), [Platform.discord])
		.addCommand(new Ban(discordBot), [Platform.discord])
		.build();

	const injest = new Injest();

	minecraftBot.registerMessageEvent((message: string) => {
		injest.injest(message);
		return false;
	});

	// Command Handlers
	discordBot.registerMessageHandler((message) => {
		// Special processing for verification... this is such bad code
		if (message.channelId === EventChannel.verify.channel_id) {
			// We know it wont return anything, so just ignore it
			verificationManager.process({
				platform: Platform.discord,
				original: message,
			});
		}
		if (message.channelId === EventChannel.commands.channel_id) {
			const response = commandManager.process({
				platform: Platform.discord,
				original: message,
			});
			if (typeof response === "undefined") return false;

			discordBot.send(response.content, EventChannel.commands.channel_id);
		}
		return false;
	});

	// Process minecraft commands and add response to redis queue
	minecraftBot.registerMessageEvent((message: string) => {
		logger.debug(`Analyzing "${message}`);

		if (!ChatEvent.regexes[0].test(message)) {
			return false;
		}

		const chat = new ChatEvent(message);
		const username = chat.getName();
		//if (username === "MarkenAP") return false;
		if (username === null) return false;

		const messageBody = message.slice(message.indexOf(": ") + 2);

		const response = commandManager.process({
			platform: Platform.minecraft,
			original: {
				author: username,
				type: ChatType.chat,
				content: messageBody,
			},
		});

		if (typeof response === "undefined") return false;

		const redisMessage = {
			message: response.content,
			messageType: "command",
		};

		if (response.sender) {
			redisMessage["proposed_nickname"] = response.sender;
		}

		client.xAdd("dc-to-mw-chat", "*", redisMessage, {
			TRIM: {
				strategy: "MAXLEN",
				threshold: 4000,
				strategyModifier: "~",
			},
		});
		return false;
	});

	minecraftBot.registerMessageEvent((message: string) => {
		//console.debug(`Parsing: ${JSON.stringify(message, null, 4)}`);
		logger.debug(`MC Cleaned Chat: "${message}"`);
		client.xAdd(
			"chat",
			"*",
			{
				message: message,
				raw: JSON.stringify(message),
				messageType: "chat",
			},
			{
				TRIM: {
					strategy: "MAXLEN",
					threshold: 4000,
					strategyModifier: "~",
				},
			},
		);
		return false;
	});

	let prevId = (await client.get("prevId")) || "0-0";

	async function pollQueue() {
		logger.debug("Polling...");
		const rawChatStream = await client.xRead(
			{ key: "chat", id: prevId },
			{ COUNT: 5 },
		);
		// This simply means no new messages
		if (rawChatStream === null) {
			return;
		}
		const chatStream = chatStreamSchema.safeParse(rawChatStream);
		if (chatStream.error) {
			logger.warn(`Failed to parse chat stream`, chatStream.error);
			return;
		}
		const lastValue = chatStream.data[0].messages.at(-1);
		if (lastValue === undefined) {
			return;
		}

		chatStream.data[0].messages
			.map((message) => message.message.message)
			.forEach((message) => {
				//console.log(`Discord side looking at "${message}"`);
				if (VoteEvent.isValid(message)) {
					discordBot.queue(
						new VoteEvent(message).generateDiscordMessage(),
						EventChannel.vote.channel_id,
					);
				} else if (WelcomeEvent.isValid(message)) {
					discordBot.queue(
						new WelcomeEvent(message).generateDiscordMessage(),
						EventChannel.welcome.channel_id,
					);
				} else if (SharpeningEvent.isValid(message)) {
					discordBot.queue(
						new SharpeningEvent(message).generateDiscordMessage(),
						EventChannel.sharpening.channel_id,
					);
				} else if (SnovasionEvent.isValid(message)) {
					mostRecentEvent.set("Snovasion");
					discordBot.queue(
						new SnovasionEvent(message).generateDiscordMessage(),
						EventChannel.snovasion.channel_id,
					);
				} else if (LabyrinthEvent.isValid(message)) {
					mostRecentEvent.set("Labyrinth");
					discordBot.queue(
						new LabyrinthEvent(message).generateDiscordMessage(),
						EventChannel.labyrinth.channel_id,
					);
				} else if (BeefEvent.isValid(message)) {
					mostRecentEvent.set("Beef");
					discordBot.queue(
						new BeefEvent(message).generateDiscordMessage(),
						EventChannel.beef.channel_id,
					);
				} else if (AbyssalEvent.isValid(message)) {
					mostRecentEvent.set("Abyssal");
					discordBot.queue(
						new AbyssalEvent(message).generateDiscordMessage(),
						EventChannel.abyssal.channel_id,
					);
				} else if (AttackOnGiantEvent.isValid(message)) {
					mostRecentEvent.set("Attack on Giant");
					discordBot.queue(
						new AttackOnGiantEvent(message).generateDiscordMessage(),
						EventChannel.attackongiant.channel_id,
					);
				} else if (FoxEvent.isValid(message)) {
					mostRecentEvent.set("Fox");
					discordBot.queue(
						new FoxEvent(message).generateDiscordMessage(),
						EventChannel.fox.channel_id,
					);
				} else if (BaitEvent.isValid(message)) {
					mostRecentEvent.set("Bait");
					discordBot.queue(
						new BaitEvent(message).generateDiscordMessage(),
						EventChannel.bait.channel_id,
					);
				} else if (FreeForAllEvent.isValid(message)) {
					mostRecentEvent.set("Free-for-all");
					discordBot.queue(
						new FreeForAllEvent(message).generateDiscordMessage(),
						EventChannel.freeforall.channel_id,
					);
				} else if (TeamDeathMatchEvent.isValid(message)) {
					mostRecentEvent.set("Team Deathmatch");
					discordBot.queue(
						new TeamDeathMatchEvent(message).generateDiscordMessage(),
						EventChannel.teamdeathmatch.channel_id,
					);
				} else if (CastleEvent.isValid(message)) {
					discordBot.queue(
						new CastleEvent(message).generateDiscordMessage(),
						EventChannel.castle.channel_id,
					);
				} else if (SystemEvent.isValid(message)) {
					logger.debug(`System event ${message}. Skipping...`);
					return;
				} else if (DeathEvent.isValid(message)) {
					discordBot.queue(
						new DeathEvent(message).generateDiscordMessage(),
						EventChannel.death.channel_id,
					);
				} else if (ChatEvent.isValid(message)) {
					discordBot.queue(
						new ChatEvent(message).generateDiscordMessage(),
						EventChannel.chat.channel_id,
					);
				} else {
					discordBot.queue(
						new DebugEvent(message).generateDiscordMessage(),
						EventChannel.debug.channel_id,
					);
				}
			});

		discordBot.flushAll();

		prevId = lastValue.id;
		client.set("prevId", prevId);
	}

	setInterval(pollQueue, 2000);

	let prevDCToMWId = (await client.get("prevDCToMWId")) || "0-0";

	async function pollDCToMWQueue() {
		logger.debug("Polling...");
		const rawChatStream = await client.xRead(
			{ key: "dc-to-mw-chat", id: prevDCToMWId },
			{ COUNT: 1 },
		);
		// This simply means no new messages
		if (rawChatStream === null) {
			setTimeout(pollDCToMWQueue, 1000);
			return;
		}
		logger.debug("Discord to MW Message Polled", rawChatStream);
		const dcToMWchatStream = DCToMWChatStreamSchema.safeParse(rawChatStream);
		if (dcToMWchatStream.error) {
			logger.warn(`Failed to parse chat stream`, dcToMWchatStream.error);
			setTimeout(pollDCToMWQueue, 1000);
			return;
		}

		const value = dcToMWchatStream.data[0].messages.at(0);

		if (value === undefined) {
			logger.info("Received no new items from chat stream");
			setTimeout(pollDCToMWQueue, 1000);
			return;
		}

		const rawMessage = value.message.message;
		const proposed_nickname = value.message.proposed_nickname;
		const cleanedMessage = breakLinks(rawMessage);
		if (typeof proposed_nickname !== "undefined") {
			minecraftBot.send(`/nick ${proposed_nickname}`);
		}
		minecraftBot.send(cleanedMessage);
		if (typeof proposed_nickname !== "undefined") {
			setTimeout(() => {
				minecraftBot.send("/nick DebugMenu");
			}, 250);
			//minecraftBot.send(`/nick DebugMenu`);
		}

		prevDCToMWId = value.id;
		client.set("prevDCToMWId", prevDCToMWId);
		setTimeout(pollDCToMWQueue, 5000);
	}

	pollDCToMWQueue();

	// Send discord chats into redis queue
	discordBot.registerMessageHandler((message) => {
		if (message.channelId !== EventChannel.chat.channel_id) {
			return false;
		}
		const author = message.member?.nickname || message.author.displayName;

		const [cleanedAuthor, cleanedMessage] = [author, message].map((value) => {
			return value
				.toString()
				.replace(/[^a-zA-Z0-9 _'":;+?\-*,.!@#$%^&()[\\/\]{}<>]*/gi, "");
		});

		const has_bypass_role = message.member?.roles.cache.has(
			Users.bypass.ping_group,
		);
		const allowOwnerBypass = true;
		if (
			message.author.id === Users.owner.ping_group &&
			allowOwnerBypass &&
			has_bypass_role
		) {
			minecraftBot.send(message.toString().replace(";", "/"));
		} else {
			const cleanedFmtMessage = `[DC] ${cleanedMessage}`;
			logger.debug(`Queueing "${cleanedFmtMessage}" to minecraft...`);
			client.xAdd(
				"dc-to-mw-chat",
				"*",
				{
					message: cleanedFmtMessage,
					proposed_nickname: `DC ${cleanedAuthor}`,
					raw: JSON.stringify({
						displayName: message.author.displayName,
						member_nickname: message.member?.nickname || "",
						message: message.toString(),
					}),
				},
				{
					TRIM: {
						strategy: "MAXLEN",
						threshold: 1000,
						strategyModifier: "~",
					},
				},
			);
		}

		message.delete().catch(() => {
			logger.warn(`Unable to delete message in ${message.channelId}`);
		});
		return true;
	});

	const minTimeoutMS = 600000;
	const maxTimeoutMS = 1200000;

	function advertise() {
		const discord_link = "https://discord.gg/TbmCrPmEBH";
		const advertisements = [
			`> Minewind auto event ping w/ bi-directional chat sync (in beta). ${discord_link} Try it out for yourself, send a msg in #chat and see it appear in mw!`,
			`> Minewind auto event ping w/ bi-directional chat sync (in beta). Join now ${discord_link}`,
			`> Never miss another event again with auto event pings. Join now ${discord_link}`,
			`> Talk on minewind from the comfort of discord! Join now ${discord_link}`,
			`> Try my alpha auto-price checking. Just do -pc (ess name) (level) e.g., -pc antimage 2`,
			`> Price checking supports keys. Try it now -pc jester key`,
			`> Type -help to learn about what commands I support.`,
			`> New username verification for Minewind discord. Join and try it now ${discord_link}`,
		];
		const randomIdx = Math.floor(Math.random() * advertisements.length);
		const randomAdvertisement = advertisements[randomIdx];
		logger.debug(`Sending advertise: ${randomAdvertisement}`);
		minecraftBot.unsafeSend(randomAdvertisement);
		setTimeout(advertise, getRandomInt(minTimeoutMS, maxTimeoutMS));
	}

	setTimeout(advertise, getRandomInt(1000000, 2000000));

	logger.info("Bot is started");
	manualSend(`Bot is started`, EventChannel.logging.channel_id);
	manualSend(`Bot has started`, EventChannel.chat.channel_id);
}

process.on("uncaughtException", async (error) => {
	logger.error("Crashed due to uncaught exception", {
		cause: error.cause,
		message: error.message,
		name: error.name,
		stack: error.stack,
	});
	await manualSend(
		`Exiting due to uncaught exception ${pingUser(Users.owner.ping_group)}`,
		EventChannel.logging.channel_id,
	);
	await manualSend(`Bot has stopped`, EventChannel.chat.channel_id);
	process.exit(1);
});

process.on("SIGINT", async () => {
	logger.error("Received SIGINT");
	await manualSend(
		`Bot manually stopped ${pingUser(Users.owner.ping_group)}`,
		EventChannel.logging.channel_id,
	);
	await manualSend(`Bot has stopped`, EventChannel.chat.channel_id);
	process.exit(0);
});

logger.info("Bot is about to start");
main();
