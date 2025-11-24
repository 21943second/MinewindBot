//const dotenv = require("dotenv");

import dotenv from "dotenv";

dotenv.config();

import mineflayer, { type Bot } from "mineflayer";
import { ChatMessage } from "prismarine-chat";
import { cleanMinecraftJson } from "../../src/util";
import logger from "../Logger";
// const mineflayer = require("mineflayer");

export type ChatEventHandler = (username: string, message: string) => boolean;
export type MessageEventHandler = (message: string) => boolean;

export class MinecraftBot {
	cooldown: number = 1;
	bot!: Bot; /// Interesting typescript workaround
	messageEventHandlers: MessageEventHandler[] = [];
	recentGreetings: string[] = [];

	constructor() {
		this.init();
	}
	init() {
		logger.debug("Minecraft bot initializing");
		const ip =
			process.env.NODE_ENV === "production"
				? process.env.MINECRAFT_IP
				: "localhost";
		this.bot = mineflayer.createBot({
			host: ip, // minecraft server ip
			username: process.env.MINECRAFT_EMAIL, // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
			auth: "microsoft", // for offline mode servers, you can set this to 'offline'
			version: process.env.MINECRAFT_VERSION, // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
		});
		logger.debug("Minecraft bot created. Now adding handlers");

		this.bot.on("message", (jsonMsg: ChatMessage, position: string) => {
			try {
				const message = cleanMinecraftJson(jsonMsg.json);
				// Don't send most double-welcome messages, just one
				if (message.startsWith("Welcome ")) {
					if (this.recentGreetings.includes(message)) {
						return;
					} else {
						this.recentGreetings.unshift(message);
						if (this.recentGreetings.length >= 20) this.recentGreetings.pop();
					}
				}
				for (let i = 0; i < this.messageEventHandlers.length; i++) {
					const result = this.messageEventHandlers[i](message);
					if (result === true) {
						break;
					}
				}
			} catch (error: any) {
				const nodeError: NodeJS.ErrnoException = error;
				logger.error(`Minecraft Chat Error`, nodeError);
			}
		});

		// Log errors and kick reasons:
		this.bot.on("kicked", (e) => {
			logger.warn(`Bot has been kicked`, e);
		});
		this.bot.on("error", (e) => {
			logger.error(`Bot has encountered an error`, {
				cause: e.cause,
				message: e.message,
				name: e.name,
				stack: e.stack,
			});
		});

		this.bot.once("end", (e) => {
			logger.error(`End event triggered due to ${e}. Re-attempting init`);
			this.init();
		});
	}

	registerMessageEvent(eventHandler: MessageEventHandler): void {
		this.messageEventHandlers.push(eventHandler);
	}

	unsafeSend(message: string): void {
		try {
			this.bot.chat(message);
		} catch (error) {
			logger.error(`Unable to send (unsafe) minecraft chat message`, {
				content: message,
				error: error
			});
		}
	}

	async runCommand(command: string, args: string): Promise<boolean> {
		let failed = false;

		const checkForError = (message) => {
			return (
				message === 'Unknown command. Type "/help" for help.' ||
				message === "Nick is already taken"
			);
		};

		this.messageEventHandlers.unshift((message) => {
			failed = failed || checkForError(message);
			return false;
		});

		const commandMessage = `/${command} ${args}`;

		try {
			this.bot.chat(commandMessage);
		} catch (error) {
			logger.error(`Unable to send minecraft command message`, {
				content: commandMessage,
				error: error
			});
		}

		await setTimeout(() => {
			this.messageEventHandlers.shift();
		}, 400);

		return failed;
	}

	send(message: string): void {
		message = message.slice(0, 256);
		logger.debug("Sending minecraft message", { content: message });
		try {
			this.bot.chat(message);
		} catch (error) {
			logger.error(`Unable to send minecraft chat message`, {
				content: message,
				error: error
			});
		}
	}

	getPlayerList(): string[] {
		return Object.keys(this.bot.players).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase()),
		);
	}

	getTabHeader(): string {
		return this.bot.tablist.header.toString();
	}
}
