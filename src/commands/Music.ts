import type { MinecraftBot } from "../../src/bot/MinecraftBot";
import type { DiscordBot } from "../../src/discord/DiscordBot";
import { EventChannel } from "../../src/discord/servers";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Music implements Command {
    minecraftBot: MinecraftBot;
    discordBot: DiscordBot;
    constructor(minecraftBot: MinecraftBot, discordBot: DiscordBot) {
        this.minecraftBot = minecraftBot;
        this.discordBot = discordBot;
    }
    isValid(command: CommandType): boolean {
        return [
            "clear",
            "join",
            "leave",
            "pause",
            "play",
            "resume",
            "shuffle",
            "fshuffle",
            "skip",
            "stop",
            "volume",
        ].includes(command.command);
    }
    process(command: CommandType): CommandResponse | undefined {
        if (command.platform !== Platform.minecraft) { return; }
        const djs = ["21943second", "snowfoxmx", "pxstel"].map(name => name.toLowerCase())
        if (!djs.some(dj => {
            return command.original.author.toLowerCase() === dj &&
                this.minecraftBot.getPlayerList().map(name => name.toLowerCase()).includes(dj);
        })) {
            return
        }
        // Now we know this msg is from a dj who is online
        this.discordBot.send(
            command.original.content,
            EventChannel.commands.channel_id,
            false,
        );

        return { content: `Performed ${command.command}...` }
    }
}

