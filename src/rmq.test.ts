import { ClientRMQ } from "@nestjs/microservices";
import { sleep, waitFor } from "./async";
import { rmqUrl } from "./config";
import { RmqClientFactory } from "./rmq";
import { consumer4test } from "./rmq-testing";
import type { AnyObject, Arg1 } from "./ts-utils.types";

const rmqOpts = {
  "urls": [rmqUrl],
  "queue": "test-nest_rmq",
  "queueOptions": {
    "durable": true
  }
}
, payloads: unknown[] = []
, consumer: Arg1<typeof consumer4test> = ({data}) => (
  payloads.push(data),
  data
)
, client = new ClientRMQ(rmqOpts)

consumer4test(rmqOpts, consumer)
beforeAll(async () => await client.connect())
afterAll(async () => {
  client.close()
  await sleep(100)
})

describe(RmqClientFactory.name, () => {
  class SomeApi extends RmqClientFactory<AnyObject>(rmqOpts) {}
  const api = new SomeApi(client as any)
  
  beforeAll(() => api.onModuleInit())
  afterAll(() => api.onModuleDestroy())

  beforeEach(() => payloads.length = 0)
  
  it("send", async () => expect({
    "sent": await api.send.pattern({"type": "send"}),
    payloads
  }).toStrictEqual({
    "sent": {"type": "send"},
    "payloads": [{"type": "send"}]
  }))

  it("emit", async () => {
    const emitted = await api.emit.pattern({"type": "emit"})
    , waited = await waitFor(() => payloads.length > 0, {"interval": 50, "maxCalls": 10})

    expect({emitted, waited,payloads}).toStrictEqual({
      "emitted": true,
      "waited": true,
      "payloads": [{"type": "emit"}]
    })
  })
})
