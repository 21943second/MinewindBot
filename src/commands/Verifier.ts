import { Message, OmitPartialGroupDMChannel } from "discord.js";
import { MinecraftBot } from "../bot/MinecraftBot";
import { DiscordBot } from "../discord/DiscordBot";
import { EventChannel, Users } from "../discord/servers";
import logger from "../Logger";
import { generateNLengthNumber } from "../util";
import Command, { CommandResponse, CommandType, Platform } from "./Command";

const COOLDOWN_SEC = 60;

export class Verifier implements Command {
	minecraftBot: MinecraftBot;
	discordBot: DiscordBot;
	// TODO: This will grow to takeup unlimited space. Need to implement
	// pruning/triming in the future.
	pendingVerifications: Map<string, PendingVerification> = new Map();

	constructor(minecraftBot: MinecraftBot, discordBot: DiscordBot) {
		this.minecraftBot = minecraftBot;
		this.discordBot = discordBot;
	}

	isValid(command: CommandType): boolean {
		return command.command === "verify" || command.command === "confirm";
	}

	process(command: CommandType): CommandResponse | undefined {
		if (command.platform !== Platform.discord) return;
		if (command.command === "verify") {
			this.verify(command);
		} else if (command.command === "confirm") {
			this.confirm(command);
		}
		return;
	}

	verify(command: CommandType) {
		if (command.platform !== Platform.discord) return;
		const verificationCode = generateNLengthNumber(6);
		if (command.args.length < 1) {
			this.discordBot.send(
				"Missing IGN. Please use the format -verify <ign>. E.g., '-verify 21943second'",
				EventChannel.verify.channel_id,
				false,
			);
			return;
		}

		const proposedIGN = command.args[0].replace(/[^a-zA-Z0-9_]/g, "");
		const userId = command.original.author.id;
		const currentTime = Date.now();

		const CONFIRM_CODE_FMT = /^\d{6}$/;
		if (CONFIRM_CODE_FMT.test(proposedIGN)) {
			this.discordBot.send(
				`You likely intended to do -confirm <code> instead of -verify. If you actually have a 6-digit numeric IGN, please contact a staff.`,
				EventChannel.verify.channel_id,
				false,
			);
			return;
		}

		if (userId in this.pendingVerifications) {
			const pendingVerification: PendingVerification =
				this.pendingVerifications[userId];

			const secondsDelta: number =
				(currentTime - pendingVerification.updated_at) / 1000;

			if (secondsDelta < COOLDOWN_SEC) {
				this.discordBot.send(
					`Wait for ${Math.floor(COOLDOWN_SEC - secondsDelta)} seconds before attempting to verify again.`,
					EventChannel.verify.channel_id,
					false,
				);
				return;
			}
		}

		this.pendingVerifications[userId] = new PendingVerification(
			command.original,
			proposedIGN,
			verificationCode,
			currentTime,
		);

		this.discordBot.send(
			"Sent verification message in minecraft. Check it and reply here.",
			EventChannel.verify.channel_id,
			false,
		);

		this.minecraftBot.send(
			`/msg ${proposedIGN} Verification Code: ${verificationCode}. Please go to discord and -confirm <code>`,
		);
	}

	confirm(command: CommandType) {
		if (command.platform !== Platform.discord) return;

		logger.debug("Checking for confirmation");
		const userId = command.original.author.id;
		if (command.args.length < 1) {
			this.discordBot.send(
				"Please use the format -confirm <your code> e.g., -confirm 123456",
				EventChannel.verify.channel_id,
				false,
			);
			return;
		}
		let attemptedVerificationCode = command.args[0];
		if (attemptedVerificationCode.startsWith("<")) {
			attemptedVerificationCode = attemptedVerificationCode.slice(1);
		}
		if (attemptedVerificationCode.endsWith(">")) {
			attemptedVerificationCode = attemptedVerificationCode.slice(0, -1);
		}
		if (!(userId in this.pendingVerifications)) {
			this.discordBot.send(
				"You do not have a pending verification. Run -verify to start.",
				EventChannel.verify.channel_id,
				false,
			);
			return;
		}
		const verification: PendingVerification = this.pendingVerifications[userId];
		if (attemptedVerificationCode !== verification.verification_code) {
			this.discordBot.send(
				"Invalid verification code",
				EventChannel.verify.channel_id,
				false,
			);
			return;
		}

		this.confirmUser(command.original);
		return;
	}

	private confirmUser(
		confirmMessage: OmitPartialGroupDMChannel<Message<boolean>>,
	) {
		const userId = confirmMessage.author.id;
		const verification: PendingVerification = this.pendingVerifications[userId];
		const verifyMessage = verification.discord_message;
		const member = verifyMessage.member;
		if (member === null) {
			logger.warn(
				`Unable to confirm null member: ${verifyMessage.author.globalName}`,
				verification,
				verifyMessage,
			);
			return;
		}
		member.roles
			.add(Users.verified_player.ping_group)
			.then((guildMember) => {
				logger.info(
					`Successfully verified ${verification.proposed_ign}`,
					verification,
				);
				member.setNickname(verification.proposed_ign);
				verifyMessage.react("✅");
				confirmMessage.react("✅");
				this.pendingVerifications.delete(userId);
			})
			.catch(() => {
				logger.warn(
					`Unable to confirm ${verifyMessage.author.globalName}`,
					verification,
				);
			});
	}
}

class PendingVerification {
	proposed_ign: string;
	verification_code: string;
	discord_message: OmitPartialGroupDMChannel<Message<boolean>>;
	updated_at: number;
	constructor(
		discord_message: OmitPartialGroupDMChannel<Message<boolean>>,
		proposed_ign: string,
		verification_code: string,
		updated_at: number,
	) {
		this.discord_message = discord_message;
		this.proposed_ign = proposed_ign;
		this.verification_code = verification_code;
		this.updated_at = updated_at;
	}
}
