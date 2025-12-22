import type Command from "./Command";
import type { CommandResponse, CommandType } from "./Command";

export class FAQ implements Command {
    isValid(command: CommandType): boolean {
        return command.command === "mw";
    }
    process(_: CommandType): CommandResponse | undefined {
        const minewindDescription = "Minewind is an enhanced vanilla experience with keep inv, land claims, custom magic tools+weapons+spells, and pvp-based spawn events";
        return {
            content: minewindDescription
        };
    }
}
