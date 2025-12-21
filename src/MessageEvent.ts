import { codeBlock, escapeCodeBlock, escapeMarkdown } from "discord.js";
import { Upcoming } from "./commands/Upcoming";
import { EventChannel } from "./discord/servers";
import { breakLinks, ping } from "./util";

export abstract class BaseMessageEvent {
	static regexes: RegExp[];
	message: string;
	constructor(message: string) {
		this.message = message;
	}
	static isValid(message: string) {
		return this.regexes.some((regex) => regex.test(message));
	}
	generateDiscordMessage() {
		return codeBlock(escapeCodeBlock(this.message)).toString();
	}
}

export class VoteEvent extends BaseMessageEvent {
	static regexes = [/^\/vote -> ([a-zA-Z0-9_]{2,16}): (.*)$/];
	user: string;
	vote: string;
	constructor(message: string) {
		super(message);
		const match = message.match(VoteEvent.regexes[0]);
		this.user = match?.at(0)?.toString() || "";
		this.vote = match?.at(1)?.toString() || "";
	}
}

export class WelcomeEvent extends BaseMessageEvent {
	static regexes = [/^Welcome ([a-zA-Z0-9_]{2,16})!$/];
	user: string;
	constructor(message: string) {
		super(message);
		const match = message.match(WelcomeEvent.regexes[0]);
		this.user = match?.at(0)?.toString() || "";
	}
}

export class SystemEvent extends BaseMessageEvent {
	static regexes = [
		/^Your \/chatlevel is \w+$/,
		/^You have (\d+ )?new mail. Try \/claim$/,
		/^You have \d+ rewards? to \/claim$/,
		/^Visit Minewind\.com for News and Information$/,
		/^Have an idea to better the server\? Minewind\.com\/feedback$/,
		/^Report bugs at Minewind\.com\/bugs$/,
	];
}

export class SharpeningEvent extends BaseMessageEvent {
	static regexes = [/^([a-zA-Z0-9_]{2,16}) sharpened (.*) to \+(\d+)!$/];
	user: string;
	constructor(message: string) {
		super(message);
		const match = message.match(SharpeningEvent.regexes[0]);
		this.user = match?.at(0)?.toString() || "";
	}
}

export abstract class EventMessageEvent extends BaseMessageEvent {
	static allowed_times = [
		"1 hour",
		"30 minutes",
		"5 minutes",
	]
	public abstract shouldGenerateDiscordMessage(): boolean
	public abstract isUpcomingMessage(): boolean
	protected _isUpcomingMessage(regexes: RegExp[], message: string): boolean {
		return regexes[0].test(message)
	}
	protected _shouldGenerateDiscordMessage(regexes: RegExp[], message: string): boolean {
		if (!regexes[0].test(message)) {
			return true;
		}
		if (EventMessageEvent.allowed_times.includes(message.match(regexes[0])?.at(1) || "")) {
			return true;
		}
		return false;
	}
	abstract isEndMessage(): boolean
	protected _generatePingDiscordMessage(message: string, ping_groups: string[], shouldTimeStamp: boolean) {
		const ping_section = ping_groups.map(group => ping(group)).join(" ");
		if (shouldTimeStamp) {
			const timestamp = Upcoming.timeStringToTimeStamp(message);
			if (typeof timestamp !== "undefined") {
				message += ` ${timestamp}`
			}
		}
		message += ` ${ping_section}`
		return message;
	}

}

export class SnovasionEvent extends EventMessageEvent {
	static regexes = [
		/^Snovasion Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\./,
		/^Snowmen invade \/pvp!/,
		/^Snowmen melt away!$/,
	];
	shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(SnovasionEvent.regexes, this.message);
	}
	isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(SnovasionEvent.regexes, this.message);
	}
	generateDiscordMessage(): string {
		if (SnovasionEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.snovasion.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}
	isEndMessage(): boolean {
		return SnovasionEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class LabyrinthEvent extends EventMessageEvent {
	static regexes = [
		/^Labyrinth Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Labyrinth event is starting\.\.\.$/i,
		/^Labyrinth event has started!$/i,
		/^Labyrinth event has ended!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(LabyrinthEvent.regexes, this.message) && !LabyrinthEvent.regexes[1].test(this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(LabyrinthEvent.regexes, this.message);
	}

	generateDiscordMessage(): string {
		if (
			LabyrinthEvent.regexes[0].test(this.message)
		) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.labyrinth.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return LabyrinthEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class BeefEvent extends EventMessageEvent {
	static regexes = [
		/^Beef Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Beef has started!$/i,
		/^Team (aqua|red) wins the beef event!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(BeefEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(BeefEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (BeefEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.beef.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return BeefEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class AbyssalEvent extends EventMessageEvent {
	static regexes = [
		/^Abyssal event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/,
		/^Abyssal event has started!$/,
		/^[a-zA-Z0-9_]{2,16} wins the abyssal event! Poseidon is pleased!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(AbyssalEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(AbyssalEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (AbyssalEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.abyssal.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message} - 1s, 2 abyssal keys, 1 fmb, 64 gaps, 64 gold coins`;
		}
	}

	isEndMessage(): boolean {
		return AbyssalEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class AttackOnGiantEvent extends EventMessageEvent {
	static regexes = [
		/^Attack on Giant Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Attack on Giant Event has begun!$/i,
		/^Attack on Giant Event ends!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(AttackOnGiantEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(AttackOnGiantEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (AttackOnGiantEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.attackongiant.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return AttackOnGiantEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class FoxEvent extends EventMessageEvent {
	static regexes = [
		/^Fox Hunt Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Fox Hunt has begun!$/i,
		/^1\) [a-zA-Z0-9_]{2,16} -- \d+ foxes$/i,
		/^2\) [a-zA-Z0-9_]{2,16} -- \d+ foxes$/i,
		/^3\) [a-zA-Z0-9_]{2,16} -- \d+ foxes$/i,
		/^Fox Hunt event ends!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(FoxEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(FoxEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (FoxEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.fox.ping_group, EventChannel.general.ping_group], true);
		} else if (FoxEvent.regexes[2].test(this.message)) {
			return `${this.message} - 52 deggs, 1 forbidden cacao beans`;
		} else if (FoxEvent.regexes[3].test(this.message)) {
			return `${this.message} - 42 deggs`;
		} else if (FoxEvent.regexes[4].test(this.message)) {
			return `${this.message} - 32 deggs`;
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return FoxEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class BaitEvent extends EventMessageEvent {
	static regexes = [
		/^Bait Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Bait Event has started!$/i,
		/^[123]\) [a-zA-Z0-9_]{2,16} -- \d+ fish$/i,
		/^Fishing event ends!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(BaitEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(BaitEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (BaitEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.bait.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return BaitEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class CastleEvent extends EventMessageEvent {
	static regexes = [
		/^Battle for Minewind begins in (1 hour|\d+ minutes?|\d+ seconds?)\.(\n.*)?$/i,
		/^Battle for Minewind (has started!?|has begun!?)\.?$/i,
		/^[a-zA-Z0-9 ]{1,64} \([a-zA-Z0-9]{1,4}\) hold the Minewind City!$/i,
		/^[a-zA-Z0-9 ]{1,64} \([a-zA-Z0-9]{1,4}\) take the Minewind City from [a-zA-Z0-9 ]{1,64} \([a-zA-Z0-9]{1,4}\)!(.*\n.*)*$/i,
	];
	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(CastleEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(CastleEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (CastleEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.castle.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return CastleEvent.regexes.at(-1)?.test(this.message) || CastleEvent.regexes.at(-2)?.test(this.message) || false;
	}
}

export class TeamDeathMatchEvent extends EventMessageEvent {
	static regexes = [
		/^Team Deathmatch Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^Team (aqua|red) wins the Team Deathmatch event!$/,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(TeamDeathMatchEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(TeamDeathMatchEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (
			TeamDeathMatchEvent.regexes[0].test(this.message)
		) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.teamdeathmatch.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return TeamDeathMatchEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class FreeForAllEvent extends EventMessageEvent {
	static regexes = [
		/^Free-For-All Event begins in (1 hour|\d+ minutes?|\d+ seconds?)\.$/i,
		/^[123]\) [a-zA-Z0-9_]{2,16} -- \d+ kills$/,
		/^Free-For-All event ends!$/i,
	];

	public shouldGenerateDiscordMessage(): boolean {
		return this._shouldGenerateDiscordMessage(FreeForAllEvent.regexes, this.message)
	}
	public isUpcomingMessage(): boolean {
		return this._isUpcomingMessage(FreeForAllEvent.regexes, this.message)
	}

	generateDiscordMessage(): string {
		if (FreeForAllEvent.regexes[0].test(this.message)) {
			return this._generatePingDiscordMessage(this.message, [EventChannel.freeforall.ping_group, EventChannel.general.ping_group], true);
		} else {
			return `${this.message}`;
		}
	}

	isEndMessage(): boolean {
		return FreeForAllEvent.regexes.at(-1)?.test(this.message) || false;
	}
}

export class ChatEvent extends BaseMessageEvent {
	static regexes = [
		/^(☘ )?([a-zA-Z0-9]{1,4}\.)?([a-zA-Z0-9❤_ ]{1,16}): .*$/,
		/^\* ([a-zA-z0-9_ ❤]{1,16}) (.*)$/,
	];

	generateDiscordMessage(): string {
		if (this.message.includes(": >")) {
			return codeBlock("diff", `+${this.cleaned()}`);
		} else if (this.message.includes(": <")) {
			return codeBlock("diff", `-${this.cleaned()}`);
		} else if (this.message.startsWith("* ")) {
			return codeBlock("markdown", `#${escapeMarkdown(this.cleaned())}`);
		} else {
			return codeBlock(this.cleaned());
		}
	}

	cleaned(): string {
		const cleaned =
			this.message.slice(0, 6) + breakLinks(this.message.slice(6));
		return escapeCodeBlock(cleaned);
	}

	getClanTag(): string | null {
		if (!ChatEvent.regexes[0].test(this.message)) {
			return null;
		}
		const match = this.message.match(ChatEvent.regexes[0]);
		if (match === null) {
			return null;
		}
		const tagWithDot = match[2];
		if (typeof tagWithDot === "undefined") {
			return null;
		}
		const tag = tagWithDot.slice(0, tagWithDot.length - 1);
		return tag;
	}

	getName(): string | null {
		if (!ChatEvent.regexes[0].test(this.message)) {
			return null;
		}
		const match = this.message.match(ChatEvent.regexes[0]);
		if (match === null) {
			return null;
		}
		return match[3];
	}
}

export class DebugEvent extends BaseMessageEvent {
	static regexes = [/.*/];
}

export class DeathEvent extends BaseMessageEvent {
	static regexes = [
		/^[a-zA-Z0-9_]{2,16} is on RAMPAGE!+$/,
		/^[a-zA-Z0-9_]{2,16} died$/,
		/^[a-zA-Z0-9_]{2,16} starved to death( while fighting .*)?$/,
		/^[a-zA-Z0-9_]{2,16} drowned( while trying to escape .*)?$/,
		/^[a-zA-Z0-9_]{2,16} blew up$/,
		/^[a-zA-Z0-9_]{2,16} self-disintegrated$/,
		/^[a-zA-Z0-9_]{2,16} was pricked to death$/,
		/^[a-zA-Z0-9_]{2,16} died to the void \(Death #\d+\)$/,
		/^[a-zA-Z0-9_]{2,16} went up in flames$/,
		/^[a-zA-Z0-9_]{2,16} fell off a ladder$/,
		/^[a-zA-Z0-9_]{2,16} burned to death$/,
		/^[a-zA-Z0-9_]{2,16} went off with a bang( due to a firework fired from .*)?$/,
		/^[a-zA-Z0-9_]{2,16} froze to death$/,
		/^[a-zA-Z0-9_]{2,16} lost \d+ fish as they teleported away$/,
		/^[a-zA-Z0-9_]{2,16} was frozen to death by .*$/,
		/^[a-zA-Z0-9_]{2,16} pwned [a-zA-Z0-9_]{2,16} for \d+!$/,
		/^[a-zA-Z0-9_]{2,16} rekt [a-zA-Z0-9_]{2,16} for \d+ fish$/,
		/^[a-zA-Z0-9_]{2,16} got \d+ (fish|kills) from [a-zA-Z0-9_]{2,16} as they ran away$/,
		/^[a-zA-Z0-9_]{2,16} lost \d+ (fish|kills) as they ran away$/,
		/^[a-zA-Z0-9_]{2,16} was stung to death$/,
		/^[a-zA-Z0-9_]{2,16} was obliterated by a sonically-charged shriek$/,
		/^[a-zA-Z0-9_]{2,16} was poked to death by a sweet berry bush( while trying to escape .*)?$/,
		/^[a-zA-Z0-9_]{2,16} was struck by lightning( while fighting .*)?$/,
		/^[a-zA-Z0-9_]{2,16} committed blood sacrifice$/,
		/^[a-zA-Z0-9_]{2,16} discovered the floor was lava$/,
		/^[a-zA-Z0-9_]{2,16} didn't want to live in the same world as .*$/,
		/^[a-zA-Z0-9_]{2,16} tried to swim in lava( to escape .*)?$/,
		/^[a-zA-Z0-9_]{2,16} withered away( while fighting .*)?$/,
		/^[a-zA-Z0-9_]{2,16} suffocated in a wall( while fighting .*)?$/,
		/^[a-zA-Z0-9_]{2,16} fell out of the world$/,
		/^[a-zA-Z0-9_]{2,16} fell off some vines$/,
		/^[a-zA-Z0-9_]{2,16} hit the ground too hard( while trying to escape .*)?$/,
		/^[a-zA-Z0-9_]{2,16} was killed by magic$/,
		/^[a-zA-Z0-9_]{2,16} was killed by .* while trying to hurt [a-zA-Z0-9_]{2,16}$/,
		/^[a-zA-Z0-9_]{2,16} was doomed to fall( by .*)?$/,
		/^[a-zA-Z0-9_]{2,16} was doomed to fall( because of .*)?$/,
		/^[a-zA-Z0-9_]{2,16} fell from a high place$/,
		/^[a-zA-Z0-9_]{2,16} rekt [a-zA-Z0-9_]{2,16} (using .*)?(for \d+ (kills))?(and got an? (double|TRIPLE|ULTRA) kill!)?$/i,
		/^[a-zA-Z0-9_]{2,16} was (killed|rekt|slain|shot|cursed|blown up|fireballed|fragged|zapped|zeused|lavaed|spirited away|Dragon Pounced|grug stomped|sparked|batted) by [a-zA-Z0-9_' ]{2,32}.*?$/,
		/^[a-zA-Z0-9_]{2,16} was impaled by [a-zA-Z0-9_' ]{2,32}( with .*)?$/,
		/^[a-zA-Z0-9_]{2,16} was rekt by [a-zA-Z0-9_]{2,16}'s (Elder Branch|Master Blaze) using .*$/,
		/^[a-zA-Z0-9_]{2,16} experienced kinetic energy( while trying to escape .*)?$/,
		/^[a-zA-Z0-9_]{2,16} died because of [a-zA-Z0-9_]{2,16}('s .*)?$/,
		/^[a-zA-Z0-9_]{2,16} sucked [a-zA-Z0-9_]{2,16} dry$/,
		/^[a-zA-Z0-9_]{2,16} borrowed soul of [a-zA-Z0-9_]{2,16}$/,
		/^[a-zA-Z0-9_]{2,16} beefed [a-zA-Z0-9_]{2,16} for \d+!$/,
		/^[a-zA-Z0-9_]{2,16} walked into the danger zone due to [a-zA-Z0-9_]{2,16}$/,
		/^[a-zA-Z0-9_]{2,16} was burned to a crisp while fighting .*$/,
		/^[a-zA-Z0-9_]{2,16} was killed by magic while trying to escape [a-zA-Z0-9_]{2,16}$/,
		/^[a-zA-Z0-9_]{2,16} was (forked|chickened|blown up) by [a-zA-Z0-9_]{2,16}$/,
		/^[a-zA-Z0-9_]{2,16} walked into fire while fighting (.*)?$/,
	];
}
