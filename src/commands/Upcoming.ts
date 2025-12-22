import type { MinecraftBot } from "../bot/MinecraftBot";
import type { MostRecentEvent } from "../MostRecentEvent";
import { calculateTimeDelta, TimeDelta, timeStringToUnix } from "../util";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

type UpcomingMessage = {
	eventName: string,
	timeString: string | null,
}

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
			let message = upcomingMessage;
			const timestamp = Upcoming.timeStringToTimeStamp(upcomingMessage);
			if (timestamp !== null) {
				message += ` (at ${timestamp})`;
			}
			return { content: message, shouldEscape: false };
		}

		return { content: upcomingMessage };
	}

	public static generateUpcomingMessage(header: string, mostRecentString: string | null): string {
		const { eventName, timeString } = Upcoming.generateUpcomingMessageSections(header, mostRecentString);
		if (timeString === null) {
			return `${eventName}`
		}
		return `${eventName} (${timeString})`
	}

	public static generateUpcomingMessageSections(header: string, mostRecentString: string | null): UpcomingMessage {
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
				return {
					eventName: "unknown",
					timeString: "",
				}
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
						eventName: `Most Recent Event was ${mostRecentString}. Potential repeat during castle`,
						timeString: deltaString
					}
				} else {
					return {
						eventName: `Most Recent Event was ${mostRecentString}. Potential repeat after reset`,
						timeString: deltaString,
					}
				}
			}
		} else {
			const minutesRegex = /\d+/;
			const match = header.match(minutesRegex);
			if (match === null) {
				return {
					eventName: header,
					timeString: null
				}
			}
			const totalMinutes = Number(match[0]);
			const hours = Math.floor(totalMinutes / 60);
			const minutes = totalMinutes - 60 * hours;
			const timestring = this.generateTimeString({ hours: hours, minutes: minutes });
			let formatted = header.replace(` in ${totalMinutes} min`, "");

			const bfw = "Battle for Minewind";
			if (isSaturday && formatted.includes(bfw)) {
				formatted = formatted.replace(
					bfw,
					`${bfw} and ${mostRecentString}`,
				);
			}

			return {
				eventName: formatted,
				timeString: timestring,
			}
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

	public static timeStringToTimeStamp(timestring: string): string | null {
		const time = timeStringToUnix(timestring);
		if (time === null) { return null; }
		const timestamp = `<t:${time}:t>`
		return timestamp
	}
}
