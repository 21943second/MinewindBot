import type Command from "./Command";
import type {
	CommandResponse,
	DiscordMessage,
	MinecraftMessage,
	Platform,
} from "./Command";

export class CommandManager {
	prefix: string = "-";
	config: CommandManagerConfig;

	constructor(config: CommandManagerConfig) {
		this.config = config;
	}

	process(
		message: DiscordMessage | MinecraftMessage,
	): CommandResponse | undefined {
		if (!message.original.content.startsWith(this.prefix)) return;

		const messageBody = message.original.content.slice(this.prefix.length);
		const [commandString, ...args] = messageBody.split(" ");

		for (const [command, mapping] of this.config) {
			if (!mapping.includes(message.platform)) continue;
			const userCommand = {
				command: commandString,
				args: args,
				...message,
			};
			if (command.isValid(userCommand)) {
				return command.process(userCommand);
			}
		}
	}
}

// Map command to being enabled or disable for a platform (missing is considered disable)
export type CommandManagerConfig = Map<Command, Platform[]>;

export class CommandManagerBuilder {
	config: Map<Command, Platform[]>;
	mostRecent: Command | undefined;
	constructor() {
		this.config = new Map();
	}

	addCommand(command: Command, allowedPlatforms: Platform[]) {
		this.config.set(command, allowedPlatforms);
		return this;
	}

	build(): CommandManager {
		return new CommandManager(this.config);
	}
}
