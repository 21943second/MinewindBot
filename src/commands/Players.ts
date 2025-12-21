import type { MinecraftBot } from "../bot/MinecraftBot";
import type Command from "./Command";
import { Platform, type CommandResponse, type CommandType } from "./Command";

export class Players implements Command {
	bot: MinecraftBot;
	constructor(bot: MinecraftBot) {
		this.bot = bot;
	}
	isValid(command: CommandType): boolean {
		return command.command === "players" || command.command === "online";
	}
	process(command: CommandType): CommandResponse | undefined {
		if (command.platform !== Platform.discord) return;
		const playerList = this.bot.getPlayerList();
		if (command.args.length === 0) {
			return { content: playerList.join("\n") };
		}
		const destinationPlayer = command.args.join().toLowerCase()
		const filteredPlayers = playerList.filter(name => name.toLowerCase().includes(destinationPlayer))
		if (filteredPlayers.length === 0) {
			return { content: "No players with that name are online." };
		} else {
			return { content: filteredPlayers.join("\n") };
		}
	}
}
