import { MinecraftBot } from "src/bot/MinecraftBot";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Discord implements Command {
	minecraftBot: MinecraftBot;

	constructor(minecraftBot: MinecraftBot) {
		this.minecraftBot = minecraftBot;
	}
	isValid(command: CommandType): boolean {
		return command.command === "discord";
	}
	process(command: CommandType): CommandResponse | undefined {
		if (command.platform !== Platform.minecraft) return;

		const discord_link = "https://discord.gg/TbmCrPmEBH";
		this.minecraftBot.unsafeSend(`Join my discord at ${discord_link}`);
		return;
	}
}
