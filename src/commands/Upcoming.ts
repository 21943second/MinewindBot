import type { MinecraftBot } from "../bot/MinecraftBot";
import type { MostRecentEvent } from "../MostRecentEvent";
import { calculateTimeDelta, TimeDelta } from "../util";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

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
	process(command: CommandType): CommandResponse | undefined {
		const header = this.bot.getTabHeader();
		const mostRecentString = this.mostRecentEvent.get();
		const upcomingMessage = Upcoming.generateUpcomingMessage(header, mostRecentString);

		if (command.platform === Platform.discord) {
			const timestamp = Upcoming.timeStringToTimeStamp(upcomingMessage);
			return { content: `${upcomingMessage} (at ${timestamp})`, shouldEscape: false };
		}

		return { content: upcomingMessage };
	}

	public static generateUpcomingMessage(header: string, mostRecentString: string | null): string {
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
				return `Unable to determine upcoming event`;
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
					return `Most Recent Event was ${mostRecentString}. Potential repeat during castle (${deltaString}).`;
				} else {
					return `Most Recent Event was ${mostRecentString}. Potential repeat after reset (${deltaString}).`;
				}
			}
		} else {
			const minutesRegex = /\d+/;
			const match = header.match(minutesRegex);
			if (match === null) {
				return header;
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

			return formatted;
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

	private static timeStringToUnix(time: string): number | undefined {
		const hourRegex = /(\d+) (hour|hr)/;
		const minuteRegex = /(\d+) (minute|min|mn)/;
		const secondRegex = /(\d+) (second)/;
		const now = Math.round(Date.now() / 1000);
		let delta: number = 0;
		if (hourRegex.test(time)) {
			const hourMatch = time.match(hourRegex)?.at(1);
			if (hourMatch) {
				delta += 60 * 60 * parseInt(hourMatch, 10);
			}
		}
		if (minuteRegex.test(time)) {
			const minuteMatch = time.match(minuteRegex)?.at(1);
			if (minuteMatch) {
				delta += 60 * parseInt(minuteMatch, 10);
			}
		}
		if (secondRegex.test(time)) {
			const secondMatch = time.match(secondRegex)?.at(1);
			if (secondMatch) {
				delta += parseInt(secondMatch, 10);
			}
		}
		if (delta === 0) {
			return;
		}
		return now + delta
	}

	public static timeStringToTimeStamp(timestring: string): string | undefined {
		const time = Upcoming.timeStringToUnix(timestring);
		if (typeof time === "undefined") { return; }
		const timestamp = `<t:${time}:t>`
		return timestamp
	}
}
