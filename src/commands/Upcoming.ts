import type { MinecraftBot } from "../bot/MinecraftBot";
import logger from "../Logger";
import type { MostRecentEvent } from "../MostRecentEvent";
import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class Upcoming implements Command {
	bot: MinecraftBot;
	mostRecentEvent: MostRecentEvent;
	constructor(bot: MinecraftBot, mostRecentEvent: MostRecentEvent) {
		this.bot = bot;
		this.mostRecentEvent = mostRecentEvent;
	}
	isValid(command: CommandType): boolean {
		return command.command === "upcoming" || command.command === "event";
	}
	process(_: CommandType): CommandResponse | undefined {
		const header = this.bot.getTabHeader();
		const mostRecentString = this.mostRecentEvent.get();
		if (header === "") {
			if (mostRecentString === null || mostRecentString === "") {
				return { content: `Unable to determine upcoming event` };
			} else {
				const resetTime = "17:30:00";

				const currentDate = new Date();

				const resetDate = new Date(currentDate.getTime());
				resetDate.setHours(Number(resetTime.split(":")[0]));
				resetDate.setMinutes(Number(resetTime.split(":")[1]));
				resetDate.setSeconds(Number(resetTime.split(":")[2]));

				logger.debug("Current Date", currentDate);
				logger.debug("Reset Date", resetDate);

				const deltaMinutesTotal = Math.floor(
					(resetDate.valueOf() - currentDate.valueOf()) / 1000 / 60,
				);
				const deltaHours = Math.floor(deltaMinutesTotal / 60);
				const deltaMinutes = deltaMinutesTotal % 60;
				let deltaString = `${deltaMinutes} min`;
				if (deltaHours) {
					deltaString = `${deltaHours}h and ${deltaString}`;
				}
				return {
					content: `Most Recent Event was ${this.mostRecentEvent.get()}. Potential repeat after reset (${deltaString}).`,
				};
			}
		} else {
			const minutesRegex = /\d+/;
			const match = header.match(minutesRegex);
			if (match === null) {
				return { content: header };
			}
			const totalMinutes = Number(match[0]);
			const hours = Math.floor(totalMinutes / 60);
			const minutes = totalMinutes - 60 * hours;
			let out = "";
			if (hours > 0 && minutes > 0) {
				out = `${hours} hr and ${minutes} min`;
			} else if (hours > 0) {
				out = `${hours} hr`;
			} else {
				out = `${minutes} min`;
			}
			const formatted = header.replace(`${totalMinutes} min`, out);
			return { content: formatted };
		}
	}
}
