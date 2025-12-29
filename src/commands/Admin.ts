import type { MinecraftBot } from "../../src/bot/MinecraftBot";
import type { DiscordBot } from "../../src/discord/DiscordBot";
import logger from "../../src/Logger";
import type { MostRecentEvent } from "../../src/MostRecentEvent";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Admin implements Command {
    static ADMINS = ["21943second"]
    minecraftBot: MinecraftBot;
    discordBot: DiscordBot;
    mostRecentEvent: MostRecentEvent;
    constructor(minecraftBot: MinecraftBot, discordBot: DiscordBot, mostRecentEvent: MostRecentEvent) {
        this.minecraftBot = minecraftBot;
        this.discordBot = discordBot;
        this.mostRecentEvent = mostRecentEvent;
    }
    isValid(command: CommandType): boolean {
        return [
            "drop",
            "array"
        ].includes(command.command);
    }
    process(command: CommandType): CommandResponse | undefined {
        if (command.platform !== Platform.minecraft) { return; }
        if (!Admin.isAdmin(command.original.author, this.minecraftBot)) {
            return;
        }

        switch (command.command) {
            case "drop": {
                const rawIndex = command.args.at(0)
                if (typeof rawIndex === "undefined") return;
                const index = parseInt(rawIndex, 10);
                this.dropIndex(index);
                break;
            }
            case "array": {
                const [fromSlot, toStart, toEnd] = command.args.map(arg => parseInt(arg, 10));
                this.arraySlot(fromSlot, toStart, toEnd);
                break;
            }
            default: {
                return;
            }
        }
    }

    private static isAdmin(author: string, mcBot: MinecraftBot): boolean {
        if (Admin.ADMINS.some(admin => {
            return author === admin &&
                mcBot.getPlayerList().includes(admin);
        })) {
            return true;
        }
        return false;
    }

    private async dropIndex(index: number) {
        const inv = this.minecraftBot.bot.inventory;
        const item = inv.slots.at(index);
        if (item === null || typeof item === "undefined") {
            return
        }
        this.minecraftBot.bot.tossStack(item);
    }

    private arraySlot(fromIndex: number, toStart: number, toEnd: number) {
        const bot = this.minecraftBot.bot;
        bot.simpleClick.leftMouse(fromIndex);
        logger.debug(`Attempting to put the item from ${fromIndex} across ${toStart}:${toEnd}`)
        for (let i = toStart; i < toEnd; i++) {
            bot.simpleClick.rightMouse(i);
        }
        bot.simpleClick.leftMouse(toEnd);
    }
}

