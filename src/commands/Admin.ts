import { MostRecentEvent } from "src/MostRecentEvent";
import type { MinecraftBot } from "../../src/bot/MinecraftBot";
import type { DiscordBot } from "../../src/discord/DiscordBot";
import logger from "../../src/Logger";
import { timeStringToUnix } from "../../src/util";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";
import { Upcoming } from "./Upcoming";

export class Admin implements Command {
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
            "create"
        ].includes(command.command);
    }
    process(command: CommandType): CommandResponse | undefined {
        if (command.platform !== Platform.minecraft) { return; }
        const admins = ["21943second"]
        if (!admins.some(admin => {
            return command.original.author === admin &&
                this.minecraftBot.getPlayerList().includes(admin);
        })) {
            return;
        }

        logger.debug(`Attempting to create an event...`)

        const { eventName, timeString } = Upcoming.generateUpcomingMessageSections(this.minecraftBot.getTabHeader(), this.mostRecentEvent.get());
        logger.debug(`Time stamp: ${timeString}`)
        if (timeString === null) return;
        const time = timeStringToUnix(timeString);
        logger.debug(`Time: ${time}`)
        if (time === null) return;
        this.discordBot.createEvent({
            name: eventName,
            time: time,
            duration_min: 15,
        })

        logger.debug(`Created an event`)

        return { content: `Created an event` }
    }
}

