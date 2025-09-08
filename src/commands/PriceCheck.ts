import { codeBlock, escapeCodeBlock } from "discord.js";
import { EssencePriceChecker } from "../bot/essences/EssencePriceChecker";
import { ItemPriceChecker } from "../bot/keys/GenericPriceChecker";
import { EventChannel } from "../discord/servers";
import { manualSend } from "../util";
import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class PriceCheck implements Command {
	essencePriceChecker: EssencePriceChecker;
	keyPriceChecker: ItemPriceChecker;

	constructor() {
		this.essencePriceChecker = new EssencePriceChecker();
		this.keyPriceChecker = new ItemPriceChecker();
	}
	isValid(command: CommandType): boolean {
		return command.command === "pc";
	}
	process(command: CommandType): CommandResponse | undefined {
		const key_result = this.keyPriceChecker.process(command.args);
		const essence_result = this.essencePriceChecker.process(command.args);

		const message = key_result || essence_result;

		manualSend(
			codeBlock(
				`>>> ${escapeCodeBlock(command.args.join(" "))}\n<<< ${message || "undefined"}`,
			),
			EventChannel.debug.channel_id,
		);

		if (typeof message === "undefined") return;

		return { content: message, sender: "Price Check" };
	}
}
