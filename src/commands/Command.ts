import { Message, OmitPartialGroupDMChannel } from "discord.js";

export default interface Command {
	isValid(command: CommandType): boolean;
	process(command: CommandType): CommandResponse | undefined;
}

export enum Platform {
	minecraft = 1,
	discord,
}

export enum ChatType {
	chat = 1,
	privateMessage,
}

export type MinecraftMessage = {
	platform: Platform.minecraft;
	original: {
		author: string;
		type: ChatType;
		content: string;
	};
};

export type DiscordMessage = {
	platform: Platform.discord;
	original: OmitPartialGroupDMChannel<Message<boolean>>;
};

export type BaseCommandType = {
	command: string;
	args: string[];
};

export type CommandType = BaseCommandType & (DiscordMessage | MinecraftMessage);

export type CommandResponse = {
	content: string;
	sender?: string;
};
