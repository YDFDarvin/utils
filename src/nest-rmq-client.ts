import { ClientRMQ } from "@nestjs/microservices";
import type { Channel } from "amqplib";
import type { NestRmqClient } from "./nest";
import type { Fn } from "./ts-utils.types";

const events_1 = require("events");

ClientRMQ.prototype.setupChannel = setupChannel

export { setupChannel };

async function setupChannel(this: ClientRMQ, channel: Channel, resolve: Fn) {
  const self = this as unknown as NestRmqClient

  // Instead of await channel.assertQueue(this.queue, this.queueOptions);
  try {
    await channel.checkQueue(self.options.queue)

    self.disabled = false

    this.responseEmitter = new events_1.EventEmitter();
    this.responseEmitter.setMaxListeners(0);
    await this.consumeChannel(channel);
    resolve();
  } catch (e: any) {
    if (e.code === 404)
      self.disabled = true
      
    console.error(e)

    resolve()
  }
}
