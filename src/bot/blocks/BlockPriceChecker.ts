import { distance } from "fastest-levenshtein";
import * as fs from "fs";
import * as Papa from "papaparse";
import logger from "../../Logger";
import { unspaceAndLowercase } from "../../util";

export class BlockPriceChecker {
    itemMap!: Map<string, Item>;
    itemMapMaginalized!: Map<string, Item>;

    constructor() {
        this.update();
    }

    update() {
        const file = fs.readFileSync("./src/bot/blocks/prices.csv", "utf-8");
        const alias_file = fs.readFileSync("./src/bot/blocks/aliases.csv", "utf-8");
        const grid = Papa.parse<string[]>(file).data;
        const alias_grid = Papa.parse<string[]>(alias_file).data;

        const prices = extract_prices(grid)
        const items = extract_items(grid, prices);
        parseAndInsertAliases(alias_grid, items);
        this.itemMap = generateFullMap(items);
        this.itemMapMaginalized = marginalizeMap(this.itemMap);
    }

    process(argList: string[]): [string, number] | undefined {
        let item_name = argList.join(" ").toLowerCase().trim();
        const prefixes = ["infinite block of", "infinite block", "infinite", "inf block", "inf"];
        let is_inf_block = false;
        let used_prefix = "";
        for (const prefix of prefixes) {
            if (item_name.startsWith(prefix)) {
                item_name = item_name.slice(prefix.length).trim();
                used_prefix = prefix;
                is_inf_block = true;
                break;
            }
        }
        if (!is_inf_block) return;
        if (item_name.includes("slab")) {
            return ["PC: All Slabs go for around 20-32 deggs", 0]
        } else if (item_name.includes("stair")) {
            return ["PC: All Stairs go for around 20-32 deggs", 0]
        } else if (item_name.includes("wall")) {
            return ["PC: All Walls go for around 25-32 deggs", 0]
        }
        const item: Item | undefined = this.lookupItem(item_name);
        if (typeof item !== "undefined") {
            return [item.generatePriceString(), 0];
        }
        const [closest, distance] = this.determine_closest(item_name);
        const closestItem = this.lookupItem(closest);
        if (
            item_name.length > 4 &&
            distance <= 2 &&
            typeof closestItem !== "undefined"
        ) {
            return [closestItem.generatePriceString(), distance];
        } else {
            return [`Unable to price check that item. Maybe try ${used_prefix} ${closest}. Note: pc ONLY supports essences, keys, and some infs.`, distance];
        }
    }

    // TODO: Update to return string *and* distance so someone else can deal
    // with determining global closest.
    determine_closest(item_name: string): [string, number] {
        const distances = {};
        for (const realname of Object.keys(this.itemMap)) {
            //logger.debug(`${realname}.startsWith(${item_name}) = ${realname.startsWith(item_name)}`)
            distances[realname] = realname.startsWith(item_name) ? 3 : distance(realname, item_name);
        }
        logger.debug(`Levenshtein calculations for ${item_name} `, distances);
        const closest = Object.keys(distances).reduce((a, b) =>
            distances[a] > distances[b] ? b : a,
        );
        return [closest, distances[closest]];
    }

    lookupItem(essenceName: string): Item | undefined {
        logger.log(`Checking block map for ${essenceName}`, this.itemMapMaginalized)
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
        return `PC: Infinite ${this.title} costs ${this.price} `;
    }

    addAliases(aliases: string[]) {
        this.aliases.push(...aliases.map((alias) => alias.toLowerCase().trim()));
    }

    toString() {
        return `${this.title}:${this.price} `;
    }
}

function extract_prices(grid: string[][]): Map<string, string> {
    const prices = new Map<string, string>();
    const price_chart = grid.slice(21, 29);
    for (const row of price_chart) {
        const price = row[4].trim();
        const tier = row[5].trim();
        prices[tier] = price;
    }
    logger.debug(`Prices grid is`, { "prices": prices })
    return prices
}

function extract_items(grid: string[][], prices: Map<string, string>): Map<string, Item> {
    const items = new Map<string, Item>();
    for (const row of grid) {
        logger.debug(`Row of grid`, { "row": row })
        if (row[2] === "") continue;
        const item_name = row[1].trim();
        const tier = row[2].trim();
        if (tier === "" || typeof tier === "undefined") continue;
        const price = prices[tier];
        if (price === undefined) {
            logger.debug(`Looking up ${tier} for ${item_name} had no corresponding price`, { "prices": prices, "tier": tier })
            continue;
        }
        logger.debug(`Creating item with ${item_name}:${tier}:${price} `)
        const current = new Item(item_name, price);
        items[current.title] = current;
    }
    logger.debug(`Extracted block item list`, items)
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
