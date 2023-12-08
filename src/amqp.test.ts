import { ClientRMQ } from "@nestjs/microservices"
import type { ChannelWrapper } from "amqp-connection-manager"
import { connect } from "amqp-connection-manager"
import { channelCreate } from "./amqp"
import { rmqUrl } from "./config"
import type {
  NestRmqClient,
  RmqOpts
} from "./nest"
import { rmqNativeEmit } from "./rmq"
import type { Return } from "./ts-utils.types"

const queue = "test"
, config1 = {
  queue,
  "urls": [rmqUrl],
  "queueOptions": {
    "durable": false
  },
  "persistent": true
} as RmqOpts

describe("send vs emit", () => {
  const payloads: unknown[] = []
  , client = new ClientRMQ(config1)

  let connection: Return<typeof connect>
  , chwr: ChannelWrapper

  beforeAll(async () => {
    connection = connect(config1.urls)
    chwr = channelCreate(connection, config1,
      ({"data": payload}) => {
        payloads.push(payload)
        
        return {
          "ok": 1,
          payload
        }
      }
    )
  
    await chwr.waitForConnect()
    await client.connect()
  })
  
  afterAll(async () => {
    client.close()
    await chwr.close()
    await connection.close()
  })
  

  it("1. emit", async () => {
    await rmqNativeEmit(client as unknown as NestRmqClient, queue, {"cmd": "emit"})
  })

  it("2. send", async () => {
    const r = await client.send(queue, {"cmd": "send"}).toPromise()

    expect(r).toStrictEqual({
      "ok": 1,
      "payload": {"cmd": "send"}
    })
  })

  it("requests", () => expect(
    payloads
  ).toStrictEqual([
    {"cmd": "emit"},
    {"cmd": "send"},
  ]))
})
