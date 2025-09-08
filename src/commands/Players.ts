import type { MinecraftBot } from "../bot/MinecraftBot";
import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class Players implements Command {
	bot: MinecraftBot;
	constructor(bot: MinecraftBot) {
		this.bot = bot;
	}
	isValid(command: CommandType): boolean {
		return command.command === "players";
	}
	process(_: CommandType): CommandResponse | undefined {
		return { content: this.bot.getPlayerList().join("\n") };
	}
}
