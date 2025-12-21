import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Help implements Command {
	isValid(command: CommandType): boolean {
		return command.command === "help";
	}
	process(command: CommandType): CommandResponse | undefined {
		// TODO: This whole thing should be generated from the list of
		// register commands tbh.
		const pcMsg = "-pc (ess name) (tier). Pc works for essences, keys, and some inf blocks";
		if (command.platform === Platform.minecraft) {
			return {
				content: `I currently support 5 commands: -help, -upcoming, -explain, -search, and ${pcMsg}`,
			};
		} else if (command.platform === Platform.discord) {
			return {
				content: `I currently support: -help, -players, -upcoming, -explain, -search, and ${pcMsg}`,
			};
		}
	}
}
