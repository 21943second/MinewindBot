import { Advertisement } from "src/Advertisement";
import type { DiscordBot } from "../discord/DiscordBot";
import { EventChannel, Users } from "../discord/servers";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Advertise implements Command {
	discordBot: DiscordBot;
	advertisement: Advertisement;
	constructor(discordBot: DiscordBot, advertisement: Advertisement) {
		this.discordBot = discordBot;
		this.advertisement = advertisement;
	}

	isValid(command: CommandType): boolean {
		return command.command === "advertise";
	}

	process(command: CommandType): CommandResponse | undefined {
		if (command.platform !== Platform.discord) return;
		const member = command.original.member;
		if (member === null) return;
		const is_admin = member.roles.cache.has(Users.admin.ping_group);
		if (!is_admin) {
			this.discordBot.send(
				"Advertisements can only be set by admins",
				EventChannel.commands.channel_id,
			);
			return;
		}

		const command_params = command.args.join(" ").trim();

		if (command_params === "") {
			const message = this.advertisement.peek();
			const count = this.advertisement.getCount();
			if (message === undefined) {
				this.discordBot.send(
					`No pending advertisements`,
					EventChannel.commands.channel_id,
				);
				return;
			}
			this.discordBot.send(
				`Currently sending advertisement "${message}" into minewind ${count} times.`,
				EventChannel.commands.channel_id,
			);
			return;
		}

		if (command_params === "reset") {
			this.advertisement.set("", 0);
			this.discordBot.send(
				`Cleared the current advertisement.`,
				EventChannel.commands.channel_id,
			);
			return;
		}

		const format = /^(\d+) (.{5,})$/g;
		const match = format.exec(command_params);
		if (format.test(command_params) || !match) {
			this.discordBot.send(
				`Please pass the number of advertisements followed by the message (e.g., -advertise 3 Please buy my essences!)`,
				EventChannel.commands.channel_id,
			);
			return;
		}
		const count = parseInt(match[1], 10);
		let message = match[2].trim();

		//if (message.startsWith("/") || message.startsWith("-")) {
		message = `AD: ${message}`;
		//}

		this.advertisement.set(message, count);
		this.discordBot.send(
			`Set to send advertisement "${message}" into minewind ${count} times.`,
			EventChannel.commands.channel_id,
		);


	}
}