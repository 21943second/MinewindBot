import { codeBlock, escapeCodeBlock } from "discord.js";
import { EssenceExplainer } from "../bot/explainer/EssenceExplainer";
import { EventChannel } from "../discord/servers";
import { manualSend } from "../util";
import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class Explain implements Command {
	essenceExplainer: EssenceExplainer;

	constructor() {
		this.essenceExplainer = new EssenceExplainer();
	}

	isValid(command: CommandType): boolean {
		return command.command === "explain";
	}

	process(command: CommandType): CommandResponse | undefined {

		const selected_result = this.essenceExplainer.process(command.args);

		const [message, _distance] = selected_result;

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
