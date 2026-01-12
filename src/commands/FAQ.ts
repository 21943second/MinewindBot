import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class FAQ implements Command {
    static FAQMap = {
        "mw": "Minewind is an enhanced vanilla experience with keep inv, land claims, custom magic tools+weapons+spells, and pvp-based spawn events",
        "degg": "Deggs are dragon eggs - the server currency. they are measured in deggs (d), stacks of deggs (steggs, s), and shulkers of dragon eggs (sheggs, sh)",
        "howtodegg": "You get deggs from doing events at spawn, exploring the wild, killing bosses, and trading with other players"
    }
    isValid(command: CommandType): boolean {
        return Object.keys(FAQ.FAQMap).includes(command.command.toLowerCase());
    }
    process(command: CommandType): CommandResponse | undefined {
        return {
            content: FAQ.FAQMap[command.command.toLowerCase()] || "Unable to explain that"
        };
    }
}
