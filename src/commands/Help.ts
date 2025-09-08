import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Help implements Command {
	isValid(command: CommandType): boolean {
		return command.command === "help";
	}
	process(command: CommandType): CommandResponse | undefined {
		const essMsg = "-pc (ess name) (tier). Pc works for essences and keys";
		if (command.platform === Platform.minecraft) {
			return {
				content: `I currently support 3 commands: -help, -upcoming, and ${essMsg}`,
			};
		} else if (command.platform === Platform.discord) {
			return {
				content: `I currently support: -help, -players, -upcoming, and ${essMsg}`,
			};
		}
	}
}
