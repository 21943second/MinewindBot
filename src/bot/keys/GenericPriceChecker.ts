import { distance } from "fastest-levenshtein";
import * as fs from "fs";
import * as Papa from "papaparse";
import logger from "../../Logger";
import { unspaceAndLowercase } from "../../util";

export class ItemPriceChecker {
	itemMap!: Map<string, Item>;
	itemMapMaginalized!: Map<string, Item>;

	constructor() {
		this.update();
	}

	update() {
		const file = fs.readFileSync("./src/bot/keys/prices.csv", "utf-8");
		const alias_file = fs.readFileSync("./src/bot/keys/aliases.csv", "utf-8");
		const grid = Papa.parse<string[]>(file).data;
		const alias_grid = Papa.parse<string[]>(alias_file).data;

		const items = extract_items(grid);
		parseAndInsertAliases(alias_grid, items);
		this.itemMap = generateFullMap(items);
		this.itemMapMaginalized = marginalizeMap(this.itemMap);
	}

	process(argList: string[]): [string, number] | undefined {
		const item_name = argList.join(" ").toLowerCase().trim();
		const item: Item | undefined = this.lookupItem(item_name);
		if (typeof item !== "undefined") {
			return [item.generatePriceString(), 0];
		}
		const [closest, distance] = this.determine_closest(argList);
		const closestItem = this.lookupItem(closest);
		if (
			item_name.length > 4 &&
			distance <= 2 &&
			typeof closestItem !== "undefined"
		) {
			return [closestItem.generatePriceString(), distance];
		} else {
			return [`Unable to price check that item. Maybe try ${closest}. Note: pc ONLY supports essences, keys, and some infs.`, distance];
		}
	}

	// TODO: Update to return string *and* distance so someone else can deal
	// with determining global closest.
	determine_closest(argList: string[]): [string, number] {
		const item_name = argList.join(" ").toLowerCase().trim();
		const distances = {};
		for (const realname of Object.keys(this.itemMap)) {
			distances[realname] = distance(realname, item_name);
		}
		logger.debug(`Levenshtein calculations for ${item_name}`, distances);
		const closest = Object.keys(distances).reduce((a, b) =>
			distances[a] > distances[b] ? b : a,
		);
		return [closest, distances[closest]];
	}

	lookupItem(essenceName: string): Item | undefined {
		const cleanedName = unspaceAndLowercase(essenceName);
		if (cleanedName in this.itemMapMaginalized) {
			return this.itemMapMaginalized[cleanedName];
		}
	}
}

class Item {
	title: string;
	price: string;
	aliases: string[] = [];

	constructor(title: string, price: string) {
		this.title = title;
		this.price = price;
	}

	generatePriceString(): string {
		return `PC: ${this.title} costs ${this.price}`;
	}

	addAliases(aliases: string[]) {
		this.aliases.push(...aliases.map((alias) => alias.toLowerCase().trim()));
	}

	toString() {
		return `${this.title}:${this.price}`;
	}
}

function extract_items(grid: string[][]): Map<string, Item> {
	const items = new Map<string, Item>();
	for (const row of grid) {
		if (row.length < 2) continue;
		const item_name = row[0];
		const price = row[1];
		if (price === "" || typeof price === "undefined") continue;
		const current = new Item(item_name, price);
		items[current.title] = current;
	}
	return items;
}

function parseAndInsertAliases(
	alias_grid: string[][],
	items: Map<string, Item>,
) {
	for (const row of alias_grid) {
		const [title, ...aliases] = row;
		if (title in items) {
			items[title].addAliases(aliases);
		}
	}
}

function generateFullMap(items: Map<string, Item>) {
	const fullMap = new Map<string, Item>();
	for (const item of Object.values(items)) {
		fullMap[item.title.toLowerCase()] = item;
		for (const alias of item.aliases) {
			console.log(`Adding ${alias} for ${item.title}`);
			fullMap[alias.toLowerCase()] = item;
		}
	}
	return fullMap;
}

function marginalizeMap(fullMap: Map<string, Item>): Map<string, Item> {
	const marginalizeMap: Map<string, Item> = new Map();
	for (const [name, item] of Object.entries(fullMap)) {
		marginalizeMap[unspaceAndLowercase(name)] = item;
	}
	return marginalizeMap;
}
