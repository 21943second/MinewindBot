import dotenv from "dotenv";

dotenv.config();

import fetch from "node-fetch";
import logger from "./Logger";

export function flatten(arg: object): string {
	if (Array.isArray(arg)) {
		return arg.map((x) => flatten(x)).join("");
	}
	if (typeof arg === "string" || arg instanceof String) {
		return arg as string;
	}
	let out = "";
	if ("json" in arg) {
		out += flatten(arg["json"] || "");
	}
	if ("text" in arg) {
		out += arg["text"] || "";
	}
	if ("extra" in arg) {
		out += flatten(arg["extra"] || "");
	}
	out += arg[""] || "";
	return out;
}

export function stripMinecraftColors(message: string): string {
	message = message.replace(/§[a-zA-Z0-9]/gm, "");
	return message;
}

export function cleanMinecraftJson(message): string {
	let flatMessage = flatten(message) || "";
	let cleanedMessage = stripMinecraftColors(flatMessage);
	return cleanedMessage;
}

export function ping(role_id: string) {
	return `<@&${role_id}>`;
}

export function pingUser(user_id: string) {
	return `<@${user_id}>`;
}

export async function manualSend(message: string, channelId: string) {
	const response = await fetch(
		`https://discord.com/api/channels/${channelId}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				content: message,
			}),
		},
	);
	logger.debug(
		`Manual message "${message}" received ${response.status}-${response.statusText}`,
	);
}

export function breakLinks(message: string): string {
	return message.replace(/(?<=[A-Za-z0-9])\.(?=[A-Za-z])/gi, "(.)");
}

export function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function unspaceAndLowercase(message: string): string {
	return message.toLocaleLowerCase().replace(/ /g, "");
}

export function parseRomanNumeral(numeral: string): number | undefined {
	const rn_to_num = {
		i: 1,
		ii: 2,
		iii: 3,
		iv: 4,
		v: 5,
	};
	if (numeral in rn_to_num) {
		return rn_to_num[numeral];
	}
}

export function generateNLengthNumber(n: number): string {
	return Math.floor(Math.random() * 10 ** n)
		.toString()
		.padStart(n, "0");
}

export async function sleep(ms: number): Promise<void> {
	new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateTimeDeltaMS(time: string): number {
	const currentDate = new Date();
	const resetDate = new Date(currentDate.getTime());
	resetDate.setHours(Number(time.split(":")[0]));
	resetDate.setMinutes(Number(time.split(":")[1]));
	resetDate.setSeconds(Number(time.split(":")[2]));
	return resetDate.valueOf() - currentDate.valueOf();
}

export function calculateTimeDelta(time: string): TimeDelta {
	const deltaMinutesTotal = Math.floor(calculateTimeDeltaMS(time) / 1000 / 60);
	const deltaHours = Math.floor(deltaMinutesTotal / 60);
	const deltaMinutes = deltaMinutesTotal % 60;
	return {
		hours: deltaHours,
		minutes: deltaMinutes,
	};
}

export type TimeDelta = {
	hours: number;
	minutes: number;
};

export function timeStringToUnix(time: string): number | null {
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
	logger.debug(`Converting time stamp from ${time} to a delta of ${delta}`)
	if (delta === 0) {
		return null;
	}
	return now + delta
}