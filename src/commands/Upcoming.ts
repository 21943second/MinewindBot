import type { MinecraftBot } from "../bot/MinecraftBot";
import type { MostRecentEvent } from "../MostRecentEvent";
import { calculateTimeDelta, TimeDelta } from "../util";
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

		return Upcoming.generateUpcomingMessage(header, mostRecentString);
	}

	public static generateUpcomingMessage(header: string, mostRecentString: string | null) {
		// if (no header)
		//     guess
		// (header and castle in header and saturday)
		//     mention castle and upcoming event
		// else
		//     alter time and repeat header
		const currentDate = new Date();
		const isSaturday = currentDate.getDay() === 6;

		if (header === "") {
			if (mostRecentString === null || mostRecentString === "") {
				return { content: `Unable to determine upcoming event` };
			} else {
				let resetTime: string;

				if (isSaturday) {
					resetTime = "20:00:00";
				} else {
					resetTime = "18:30:00";
				}

				const timeDelta = calculateTimeDelta(resetTime);
				const deltaString = this.generateTimeString(timeDelta);

				if (isSaturday) {
					return {
						content: `Most Recent Event was ${mostRecentString}. Potential repeat during castle (${deltaString}).`,
					};
				} else {
					return {
						content: `Most Recent Event was ${mostRecentString}. Potential repeat after reset (${deltaString}).`,
					};
				}
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
			const out = this.generateTimeString({ hours: hours, minutes: minutes });
			let formatted = header.replace(`${totalMinutes} min`, out);

			const bfw = "Battle for Minewind";
			if (isSaturday && formatted.includes(bfw)) {
				formatted = formatted.replace(
					bfw,
					`${bfw} and ${mostRecentString}`,
				);
			}

			return { content: formatted };
		}
	}

	private static generateTimeString(delta: TimeDelta): string {
		let out = "";
		if (delta.hours > 0 && delta.minutes > 0) {
			out = `${delta.hours} hr and ${delta.minutes} min`;
		} else if (delta.hours > 0) {
			out = `${delta.hours} hr`;
		} else {
			out = `${delta.minutes} min`;
		}
		return out;
	}
}
