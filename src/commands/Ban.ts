import type { DiscordBot } from "../discord/DiscordBot";
import { EventChannel, Users } from "../discord/servers";
import logger from "../Logger";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Ban implements Command {
	discordBot: DiscordBot;
	constructor(discordBot: DiscordBot) {
		this.discordBot = discordBot;
	}

	isValid(command: CommandType): boolean {
		return command.command === "ban";
	}
	process(command: CommandType): CommandResponse | undefined {
		if (command.platform !== Platform.discord) return;
		const member = command.original.member;
		if (member === null) return;
		if (command.args.length === 0) {
			this.discordBot.send(
				`Please pass the user to be banned (e.g., -ban @21943second)`,
				EventChannel.commands.channel_id,
			);
			return;
		}
		const is_admin = member.roles.cache.has(Users.admin.ping_group);
		if (is_admin) {
			this.discordBot.send(
				`${command.args.join(" ")} has been banned.`,
				EventChannel.commands.channel_id,
			);
		} else {
			member
				.timeout(24 * 60 * 60 * 1000)
				.catch((failure) =>
					logger.warn(
						`Failed to ban ${command.original.author.username}`,
						failure,
					),
				)
				.then(() => {
					this.discordBot.queue(
						`${command.original.author.globalName} has been banned (by himself).`,
						EventChannel.debug.channel_id,
					);
					this.discordBot.send(
						`${command.args.join(" ")} has been banned.`,
						EventChannel.commands.channel_id,
					);
				});
		}

		return;
	}
}
