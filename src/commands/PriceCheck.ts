import { codeBlock, escapeCodeBlock } from "discord.js";
import { BlockPriceChecker } from '../bot/blocks/BlockPriceChecker';
import { EssencePriceChecker } from "../bot/essences/EssencePriceChecker";
import { ItemPriceChecker } from "../bot/keys/GenericPriceChecker";
import { EventChannel } from "../discord/servers";
import { manualSend } from "../util";
import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class PriceCheck implements Command {
	essencePriceChecker: EssencePriceChecker;
	keyPriceChecker: ItemPriceChecker;
	blockPriceChecker: BlockPriceChecker;

	constructor() {
		this.essencePriceChecker = new EssencePriceChecker();
		this.keyPriceChecker = new ItemPriceChecker();
		this.blockPriceChecker = new BlockPriceChecker();
	}
	isValid(command: CommandType): boolean {
		return command.command === "pc";
	}
	process(command: CommandType): CommandResponse | undefined {
		// Allow -pc dang <item name> to work
		if (command.args[0] === "dang") command.args.shift()
		if (command.args[0] === "gapple") {
			return { content: "PC: Gapple costs 1 Diamond Block Voucher", sender: "Price Check" };
		}

		let selected_result = this.blockPriceChecker.process(command.args);

		if (selected_result === undefined) {
			const resultList = [
				this.keyPriceChecker.process(command.args),
				this.essencePriceChecker.process(command.args),
			].filter(x => x !== undefined);
			const closestValue = Math.min(...resultList.map(x => x[1]));
			selected_result = resultList.filter(res => res[1] === closestValue)[0];

		}
		const message = selected_result[0];

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
