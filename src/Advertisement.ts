import { RedisClientType } from "redis";

const MESSAGE_KEY = "advertisement:message"
const COUNT_KEY = "advertisement:count"

export class Advertisement {
    message: string | null = null;
    count: number = 0;
    client: RedisClientType<any>;
    constructor(client: RedisClientType<any>) {
        this.client = client;
    }

    async init() {
        this.message = await this.client.get(MESSAGE_KEY);
        this.count = parseInt((await this.client.get(COUNT_KEY)) || "", 10);
    }

    set(message: string, count: number) {
        this.client.set(MESSAGE_KEY, message);
        this.client.set(COUNT_KEY, count);
        this.message = message;
        this.count = count;
    }

    get() {
        if (this.count > 0 && !!this.message) {
            this.count -= 1;
            this.client.set(COUNT_KEY, this.count);
            return this.message;
        }
        return;
    }

    peek() {
        if (this.count > 0 && !!this.message) {
            return this.message;
        }
        return;
    }

    getCount() {
        return this.count;
    }
}
