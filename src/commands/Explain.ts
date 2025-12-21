import { codeBlock, escapeCodeBlock } from "discord.js";
import { EssenceExplainer } from "../bot/explainer/EssenceExplainer";
import { EventChannel } from "../discord/servers";
import { manualSend } from "../util";
import type Command from "./Command";
import { type CommandResponse, type CommandType, Platform } from "./Command";

export class Explain implements Command {
	essenceExplainer: EssenceExplainer;

	constructor() {
		this.essenceExplainer = new EssenceExplainer();
	}

	isValid(command: CommandType): boolean {
		return command.command === "explain" || command.command === "search";
	}

	process(command: CommandType): CommandResponse | undefined {

		let message: string;
		if (command.command === "search") {
			if (command.platform === Platform.discord) {
				message = this.essenceExplainer.reverseLookupFullDescriptions(command.args);
			} else {
				message = this.essenceExplainer.reverseLookupTitles(command.args);
			}
		} else {
			const selected_result = this.essenceExplainer.process(command.args);
			const [result_message, _distance] = selected_result;
			message = result_message;
		}

		manualSend(
			codeBlock(
				`>>> ${escapeCodeBlock(command.args.join(" "))}\n<<< ${message || "undefined"}`,
			),
			EventChannel.debug.channel_id,
		);

		if (typeof message === "undefined") return;

		return { content: message, sender: "Explainer" };
	}
}
