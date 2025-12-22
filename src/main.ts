import dotenv from "dotenv";
import process from "node:process";
import { createClient } from "redis";
import z from "zod";
import { Advertisement } from "./Advertisement";
import { MinecraftBot } from "./bot/MinecraftBot";
import { Admin } from "./commands/Admin";
import { Advertise } from "./commands/Advertise";
import { Ban } from "./commands/Ban";
import { ChatType, Platform } from "./commands/Command";
import { CommandManagerBuilder } from "./commands/CommandManager";
import { Discord } from "./commands/Discord";
import { Explain } from "./commands/Explain";
import { FAQ } from "./commands/FAQ";
import { Help } from "./commands/Help";
import { Music } from "./commands/Music";
import { Players } from "./commands/Players";
import { PriceCheck } from "./commands/PriceCheck";
import { Upcoming } from "./commands/Upcoming";
import { Verifier } from "./commands/Verifier";
import { DiscordBot } from "./discord/DiscordBot";
import { EventChannel, Users } from "./discord/servers";
import { Injest } from "./influx/injest";
import logger from "./Logger";
import { AbyssalEvent, AttackOnGiantEvent, BaitEvent, BeefEvent, CastleEvent, ChatEvent, DeathEvent, DebugEvent, FoxEvent, FreeForAllEvent, LabyrinthEvent, SharpeningEvent, SnovasionEvent, SystemEvent, TeamDeathMatchEvent, VoteEvent, WelcomeEvent } from "./MessageEvent";
import { MostRecentEvent } from "./MostRecentEvent";
import { breakLinks, getRandomInt, manualSend, pingUser, timeStringToUnix } from "./util";

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
							author: z.string().optional(),
						}),
					}),
				)
				.length(1),
		}),
	)
	.length(1);

async function main() {
	const minecraftBot = new MinecraftBot();
	const discordBot = new DiscordBot();

	const client = await createClient({
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
		socket: {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
		},
	})
		.connect();

	client.on("error", (error) => {
		logger.error("RedisClient crashed", { error: error });
	});

	const mostRecentEvent = new MostRecentEvent(client);
	await mostRecentEvent.init();
	const advertisement = new Advertisement(client);
	await advertisement.init();

	const verificationManager = new CommandManagerBuilder()
		.addCommand(new Verifier(minecraftBot, discordBot), [Platform.discord])
		.build();
	const commandManager = new CommandManagerBuilder()
		.addCommand(new Help(), [Platform.discord, Platform.minecraft])
		.addCommand(new Admin(minecraftBot, discordBot, mostRecentEvent), [Platform.minecraft])
		.addCommand(new FAQ(), [Platform.minecraft])
		.addCommand(new PriceCheck(), [Platform.discord, Platform.minecraft])
		.addCommand(new Explain(), [Platform.discord, Platform.minecraft])
		.addCommand(new Music(minecraftBot, discordBot), [
			Platform.minecraft,
		])
		.addCommand(new Upcoming(minecraftBot, mostRecentEvent), [
			Platform.discord,
			Platform.minecraft,
		])
		.addCommand(new Discord(minecraftBot), [Platform.minecraft])
		.addCommand(new Players(minecraftBot), [Platform.discord])
		.addCommand(new Ban(discordBot), [Platform.discord])
		.addCommand(new Advertise(discordBot, advertisement), [Platform.discord])
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

			let shouldEscape = true; // deafult value
			if (typeof response.shouldEscape !== "undefined") {
				shouldEscape = response.shouldEscape;
			}

			discordBot.send(response.content, EventChannel.commands.channel_id, shouldEscape);
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


	function sendCurrentEventMessage() {
		setTimeout(() => {
			const upcomingMessage = Upcoming.generateUpcomingMessage(minecraftBot.getTabHeader(), mostRecentEvent.get());
			minecraftBot.send(upcomingMessage);

			const { eventName, timeString } = Upcoming.generateUpcomingMessageSections(minecraftBot.getTabHeader(), mostRecentEvent.get());
			if (timeString === null) return;
			const time = timeStringToUnix(timeString);
			if (time === null) return;
			discordBot.createEvent({
				name: eventName,
				time: time,
				duration_min: 15,
			})
		}, 1000)
	}

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

		const eventMapping = [{
			title: "Snovasion",
			channel: EventChannel.snovasion,
			init: SnovasionEvent,
		}, {
			title: "Beef",
			channel: EventChannel.beef,
			init: BeefEvent,
		}, {
			title: "Labyrinth",
			channel: EventChannel.labyrinth,
			init: LabyrinthEvent,
		}, {
			title: "Abyssal",
			channel: EventChannel.abyssal,
			init: AbyssalEvent
		}, {
			title: "Attack on Giant",
			channel: EventChannel.attackongiant,
			init: AttackOnGiantEvent
		}, {
			title: "Fox",
			channel: EventChannel.fox,
			init: FoxEvent
		}, {
			title: "Bait",
			channel: EventChannel.bait,
			init: BaitEvent
		}, {
			title: "Free-for-all",
			channel: EventChannel.freeforall,
			init: FreeForAllEvent
		}, {
			title: "Team Deathmatch",
			channel: EventChannel.teamdeathmatch,
			init: TeamDeathMatchEvent
		}, {
			title: undefined,
			channel: EventChannel.castle,
			init: CastleEvent
		}]


		chatStream.data[0].messages
			.map((message) => message.message.message)
			.forEach((message) => {
				const matchedEvents = eventMapping.filter(event => event.init.isValid(message));
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
				} else if (matchedEvents.length >= 1) {
					const eventMap = matchedEvents[0];
					if (eventMap.title !== undefined) {
						mostRecentEvent.set(eventMap.title);
					}
					const event = new eventMap.init(message)
					if (event.shouldGenerateDiscordMessage()) {
						discordBot.queue(
							event.generateDiscordMessage(),
							eventMap.channel.channel_id,
						);
					}
					if (event.isEndMessage()) {
						sendCurrentEventMessage();
					}
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
		let proposed_nickname = value.message.proposed_nickname;
		const author = value.message.author;
		let cleanedMessage = breakLinks(rawMessage).trim().replaceAll("/", "./");
		if (typeof proposed_nickname !== "undefined") {
			proposed_nickname = proposed_nickname.slice(0, 16);
			minecraftBot.runCommand("nick", proposed_nickname).then((failed) => {
				if (failed) {
					discordBot.send(
						`Unable to change nickname to ${proposed_nickname}...`,
						EventChannel.debug.channel_id,
					);
					if (typeof author !== "undefined") {
						cleanedMessage = `[DC] ${author}: ${cleanedMessage}`;
					}
				}
			});
			minecraftBot.send(cleanedMessage);
			setTimeout(() => {
				minecraftBot.runCommand("nick", "DebugMenu");
			}, 400);
		} else {
			minecraftBot.send(cleanedMessage);
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
					author: cleanedAuthor,
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

	const minTimeoutMSSystem = 10 * 60 * 1000;
	const maxTimeoutMSSystem = 20 * 60 * 1000;
	const timeoutMSUser = 5 * 60 * 1000;

	function advertise(advertisement: Advertisement) {
		logger.debug("Sending an advertisement...")
		const user_advertisement = advertisement.get();
		if (user_advertisement !== undefined) {
			logger.debug(`Sending advertise: ${user_advertisement}`);
			minecraftBot.unsafeSend(user_advertisement);
			//setTimeout(() => advertise(advertisement), getRandomInt(minTimeoutMSUser, maxTimeoutMSUser));
			setTimeout(() => advertise(advertisement), timeoutMSUser);
		} else {
			const discord_link = "https://discord.gg/TbmCrPmEBH";
			const advertisements = [
				`> Minewind auto event ping w/ bi-directional chat sync. ${discord_link} Try it out for yourself, send a msg in #chat and see it appear in mw!`,
				//`> Minewind auto event ping w/ bi-directional chat sync. Join now ${discord_link}`,
				//`> Never miss another event again with auto event pings. Join now ${discord_link}`,
				//`> Talk on minewind from the comfort of discord! Join now ${discord_link}`,
				//`> Try my auto-price checking. Just do -pc (ess name) (level) e.g., -pc antimage 2`,
				//`> Price checking supports keys. Try it now -pc jester key`,
				//`> Price checking supports some inf blocks! Try it now -pc inf diamond block`,
				`> Type -help to learn about what commands I support.`,
				`> Essences now have explanations. Do -explain (ess name) to learn more!`,
				`> Easily find the essence you're looking for. Do -search (query) to search inside of essence descriptions (very alpha)!`,
			];
			const randomIdx = Math.floor(Math.random() * advertisements.length);
			const chosen_advertisement = advertisements[randomIdx];
			logger.debug(`Sending advertise: ${chosen_advertisement}`);
			minecraftBot.unsafeSend(chosen_advertisement);
			setTimeout(() => advertise(advertisement), getRandomInt(minTimeoutMSSystem, maxTimeoutMSSystem));
		}
	}

	setTimeout(() => advertise(advertisement), timeoutMSUser);

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

