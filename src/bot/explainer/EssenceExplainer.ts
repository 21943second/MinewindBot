import { distance } from "fastest-levenshtein";
import * as fs from "fs";
import * as Papa from "papaparse";
import logger from "../../Logger";
import { unspaceAndLowercase } from "../../util";

export class EssenceExplainer {
	originalEssenceMap!: Map<string, Essence>;
	essenceMap!: Map<string, Essence>;
	essenceMapMaginalized!: Map<string, Essence>;

	constructor() {
		this.update();
	}

	update() {
		// Read the csv files into a table
		const file = fs.readFileSync("./src/bot/explainer/explanations.csv", "utf-8");
		const alias_file = fs.readFileSync(
			"./src/bot/essences/aliases.csv",
			"utf-8",
		);
		const grid = Papa.parse<string[]>(file).data;
		const alias_grid = Papa.parse<string[]>(alias_file).data;

		this.originalEssenceMap = extract_essences(grid);
		// Make things like hgc -> high grav crit
		parseAndInsertAliases(alias_grid, this.originalEssenceMap);
		this.essenceMap = generateFullMap(this.originalEssenceMap);
		// Make auto thing work better xd
		this.essenceMapMaginalized = marginalizeMap(this.essenceMap);
	}
	reverseLookupEssences(argList: string[]): Essence[] {
		const args = argList.join("").toLowerCase();
		logger.debug(`Searching for arg "${args}"... in map of size ${this.essenceMap.size}`)
		let results: Essence[] = []
		for (const essence of Object.values(this.originalEssenceMap)) {
			logger.debug(`Comparing with ${essence.title}: ${essence.description}`)
			if (essence.description.toLowerCase().replace(" ", "").includes(args)) {
				results.push(essence);
			}
		}
		return results;
	}
	reverseLookupFullDescriptions(argList: string[]): string {
		if (argList.join("").length < 3) {
			return "Search term must be at least 3 characters long"
		}
		let results = this.reverseLookupEssences(argList);
		const countToTake = 10
		const total = results.length;
		let wasLimited = false
		if (results.length > countToTake) {
			results = results.slice(0, countToTake);
			wasLimited = true;
		}
		let message = results.map(essence => `\`\`\`${essence.generateDescription()}\`\`\``).join("\n")
		if (wasLimited) {
			message += `\n\`\`\`(Limited to ${countToTake} results of ${total} total)\`\`\``
		}
		return message.slice(3, -3);
	}
	reverseLookupTitles(argList: string[]): string {
		if (argList.join("").length < 3) {
			return "Search term must be at least 3 characters long"
		}
		const results = this.reverseLookupEssences(argList);
		return results.map(ess => ess.title).join(", ")
	}

	process(argList: string[]): [string, number] {
		// Removes the number from a command so like
		// hgc 3 just becomes hgc
		// since the explainer doesnt care about essence level 
		const args = argList.filter(x => {
			return !(/^\d+$/.test(x))
		}).join(" ").toLowerCase();

		// Remove "essence of" from query
		const spellName = args.replace("essence of", "").replace("essence", "").replace("ess", "").trim();

		// Lookup the essence in our table from above
		const ess: Essence | undefined = this.lookupEssence(spellName);
		if (typeof ess === "undefined") {
			// Being here means we don't have a match
			const distances = {};
			for (const realname of Object.keys(this.essenceMap)) {
				distances[realname] = distance(realname, spellName);
			}
			logger.debug(`Levenshtein calculations for ${spellName}`, distances);
			// Calculates the 'edit distance' between the search term and every value in our table
			const closest = Object.keys(distances).reduce((a, b) =>
				distances[a] > distances[b] ? b : a,
			);
			const closestEssence = this.lookupEssence(closest);
			const ess_distance = distance(closest, spellName);
			// This is the "autocorrect" we implement
			if (
				spellName.length > 4 && // So short names are automatically fixed to completely unrelated short ess
				ess_distance <= 2 && // only 2 "wrong" chars
				typeof closestEssence !== "undefined" // And there has to be a match, this *should* always be the case
			) {
				return [closestEssence.generateDescription(), ess_distance];
			} else {
				return [`Unable to explain that essence. Maybe try ${closest}.`, ess_distance];
			}
		} else {
			return [ess.generateDescription(), 0];
		}
	}

	lookupEssence(essenceName: string): Essence | undefined {
		const cleanedName = unspaceAndLowercase(essenceName);
		if (cleanedName in this.essenceMapMaginalized) {
			return this.essenceMapMaginalized[cleanedName];
		}
	}
}

class Essence {
	title: string;
	type: string[];
	levels: string | undefined;
	description: string;
	aliases: string[] = [];

	constructor(title: string, type: string, levels: string | undefined, description: string) {
		this.title = title;
		this.type = Array.from(type).map(v => {
			const m = {
				"⚔": "Weapon+Tool",
				"👕": "Armor",
				"✨": "Spell",
			}
			return m[v]
		});
		this.levels = levels;
		this.description = description;
	}

	static from_line(line: string[]): Essence | undefined {
		const [title, type, levels, description] = line;
		if (typeof title === "undefined") return undefined;
		return new Essence(title, type, levels, description);
	}

	generateDescription(): string {
		logger.debug(`Creating a description for ${this.title}`, {
			title: this.title,
			levels: this.levels,
			type: this.type,
			description: this.description
		})
		let out: string = this.title;
		if (this.levels) {
			out += ` ${this.levels} `
		}
		if (this.type.length > 0) {
			out += ` (${this.type.join(", ")})`
		}
		out += `: ${this.description} `

		return out
	}

	addAliases(aliases: string[]) {
		this.aliases.push(...aliases);
	}

	toString() {
		return `${this.title} @${this.type}:${this.levels}:${this.description} `;
	}
}

function extract_essences(
	grid: string[][],
): Map<string, Essence> {
	const essences = new Map<string, Essence>();
	for (const row of grid) {
		const current = Essence.from_line(row);
		if (typeof current === "undefined") continue;
		essences[current.title] = current;
	}
	return essences;
}

function parseAndInsertAliases(
	alias_grid: string[][],
	essences: Map<string, Essence>,
) {
	for (const row of alias_grid) {
		const [title, ...aliases] = row;
		if (title in essences) {
			essences[title].addAliases(aliases);
		}
	}
}

function generateFullMap(essences: Map<string, Essence>) {
	const fullMap = new Map<string, Essence>();
	for (const essence of Object.values(essences)) {
		fullMap[essence.title.toLowerCase()] = essence;
		for (const alias of essence.aliases) {
			console.log(`Adding ${alias} for ${essence.title}`);
			fullMap[alias.toLowerCase()] = essence;
		}
	}
	return fullMap;
}

function marginalizeMap(fullMap: Map<string, Essence>): Map<string, Essence> {
	const marginalizeMap: Map<string, Essence> = new Map();
	for (const [name, essence] of Object.entries(fullMap)) {
		marginalizeMap[unspaceAndLowercase(name)] = essence;
	}
	return marginalizeMap;
}
