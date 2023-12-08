import { ClientRMQ } from "@nestjs/microservices"
import type {
  ChannelWrapper,
  connect
} from "amqp-connection-manager"
import {
  $all,
  sleep
} from "./async"
import { rmqUrl } from "./config"
import { nop } from "./fn"
import {
  NestRmqClient,
  withReconnect
} from "./nest"
import "./nest-rmq-client"
import {
  rmqEmit,
  rmqSend
} from "./rmq"
import { consumer4test, createConsumer } from "./rmq-testing"
import type { Arg1, Return } from "./ts-utils.types"

describe("prove correctness", () => {
  const queue = "test-clientless"
  , client = new ClientRMQ({
    "urls": [rmqUrl],
    queue
  }) as unknown as NestRmqClient
  , queueOptions = {
    "durable": true
  }
  , rmqOpts = {queue, queueOptions, "urls": [rmqUrl]}

  describe("core check", () => {
    consumer4test(rmqOpts, nop)

    beforeAll(async () => {
      // await chwr.close()
      // await connection.close()

      await client.connect()
      await client.channel?.deleteQueue(queue)
    })
    afterAll(() => client.close())

    it("checkQueue", async () => {
      await expect(
        client.channel!.checkQueue(queue)
      ).rejects.toThrow("404 (NOT-FOUND)")

      expect(client.client).toBe(null)
    })
  })

  describe("scenario", () => {
    const payloads: unknown[] = []
    , consumer: Arg1<typeof createConsumer> = ({data}) => {
      payloads.push(data)

      return data
    }

    let connection: Return<typeof connect>
    , chwr: ChannelWrapper


    beforeAll(async () => {
      await client.connect()

      await client.channel?.deleteQueue(queue)
    })
    afterAll(() => client.close())

    afterAll(async () => {
      await chwr?.close()
      await connection?.close()
    })

    describe("1. No queue manipulations", () => {
      describe("send then emit", () => {
        beforeAll(() => client.connect())

        it("1. send", () => expect(
          rmqSend(client, "hi", {"send": "no queue [1]"}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("2. emit", () => expect(
          rmqEmit(client, "hi", {"emit": "no queue [1]"}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("3. state", () => expect({
          "isConnected": client.client?.isConnected(),
          "disabled": client.disabled
        }).toStrictEqual({
          "isConnected": false,
          "disabled": true
        }))
      })

      describe("emit then send then", () => {
        beforeAll(() => client.connect())

        it("1. emit", () => expect(
          rmqEmit(client, "hi", {"emit": "no queue [2]"}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("2. send", () => expect(
          rmqSend(client, "hi", {"send": "no queue [2]"}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("3. state", () => expect({
          "isConnected": client.client?.isConnected(),
          "disabled": client.disabled
        }).toStrictEqual({
          "isConnected": false,
          "disabled": true
        }))
      })

      describe(withReconnect.name, () => {
        const clientWithReconnect = new ClientRMQ({"urls": [rmqUrl], queue,
          socketOptions: {"reconnectTimeInSeconds": 0.1},
          //@ts-expect-error
          reconnectAttempts: 5
        }) as unknown as NestRmqClient

        beforeAll(async () => await withReconnect(clientWithReconnect))

        afterAll(async () => {
          clientWithReconnect.close()
          await sleep(1000)
        })

        it("1. send", () => expect(
          rmqSend(clientWithReconnect, "hi", {"send": withReconnect.name}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("2. emit", () => expect(
          rmqEmit(clientWithReconnect, "hi", {"emit": withReconnect.name}, {"timeout": 500})
        ).rejects.toThrow("Disabled"))

        it("3. state", () => expect({
          "isConnected": clientWithReconnect.client?.isConnected(),
          "disabled": clientWithReconnect.disabled
        }).toStrictEqual({
          "isConnected": false,
          "disabled": true
        }))
      })
    })

    describe("2. Create queue", () => {
      const service = consumer4test(rmqOpts, consumer)

      it("created", async () => expect(
        await service.channel.checkQueue(rmqOpts.queue)
      ).toStrictEqual({
        "consumerCount": 1,
        "messageCount": 0,
        "queue": rmqOpts.queue,
      }))
    })

    describe("3. No Consumer", () => {
      beforeAll(() => client.connect())

      it("1. send", async () => expect(
        rmqSend(client, "hi", {"send": "No Consumer"}, {"timeout": 500})
      ).rejects.toThrow("timeout"))

      it("2. emit", async () => expect(
        await rmqEmit(client, "hi", {"emit": "No Consumer"}, {"timeout": 500})
      ).toBe(true))
    })

    describe("4. With Consumer", () => {
      it("Send and emit", async () => {
        const p = {
          "send": rmqSend(client, "hi", {"send": "With Consumer"}, {"timeout": 5000}),
          "emit": rmqEmit(client, "hi", {"emit": "With Consumer"}, {"timeout": 5000})
        }
        , service = await createConsumer(rmqOpts, consumer).start()
        , responses = await $all(p)

        await sleep(100)

        await service.close().catch(nop)

        expect({payloads, response: responses}).toStrictEqual({
          "payloads": [
            {"send": "No Consumer"},
            {"emit": "No Consumer"},
            {"send": "With Consumer"},
            {"emit": "With Consumer"},
          ],
          "response": {
            "send": {"send": "With Consumer"},
            "emit": true,
          }
        })
      })
    })
  })
})
