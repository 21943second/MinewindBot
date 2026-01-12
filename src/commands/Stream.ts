import type Command from "./Command";
import { type CommandResponse, type CommandType } from "./Command";

export class Stream implements Command {
	isValid(command: CommandType): boolean {
		return command.command === "stream";
	}
	process(_: CommandType): CommandResponse | undefined {
		return {
			content: `Watch lilb's stream on twitch here: https://www.twitch.tv/princesslilbee`,
			shouldEscape: false
		};
	}
}
