import {
  Inject,
  Module
} from "@nestjs/common";
import {
  ClientRMQ,
  MessagePattern
} from "@nestjs/microservices";
import type { TestingModule } from "@nestjs/testing";
import fetch from "node-fetch";
import { fill } from "./array";
import { sleep } from "./async";
import {
  port,
  rmqUrl
} from "./config";
import { idfn } from "./fn";
import {
  ERROR_404,
  RmqApiModule,
  RmqHandler,
  RmqOpts,
  startRmqService,
  startRmqServiceWithWealth
} from "./nest";
import { createTestModule } from "./nest-test";
import {
  RmqClient,
  rmqEmit,
  rmqSend
} from "./rmq";
import type {
  Arg0,
  Return,
  WithLogger
} from "./ts-utils.types";

const baseUrl = `http://localhost:${port}`
, rmqOptsBase: Omit<RmqOpts, "queue"> = {
  "urls": [rmqUrl],
  "queueOptions": {
    "durable": false,
  },
  "persistent": true,
}

describe(startRmqServiceWithWealth.name, () => {
  const rmqOpts = {
    ...rmqOptsBase,
    "queue": "nest-test-dead",
  }

  class EmptyController {
    @MessagePattern("whatever")
    whatever() {
      return true
    }
  }

  @Module({
    "controllers": [EmptyController]
  })
  class EmptyModule {
  }

  describe("with", () => {
    let app: Return<typeof startRmqServiceWithWealth>

    beforeAll(async () => {
      app = await startRmqServiceWithWealth(
        {
          port,
          "prefix": ""
        },
        rmqOpts,
        EmptyModule
      )
    })
    afterAll(async () => await app.close())

    it("/metrics", async () => expect(
      await fetch(`${baseUrl}/metrics`)
      .then(r => r.text())
    ).toMatch(/^# HELP /))

    it("/healthcheck", async () => expect(
      await fetch(`${baseUrl}/healthcheck`)
      .then(r => r.status)
    ).toBe(201))
  })

  describe("without", () => {
    let app: Return<typeof startRmqServiceWithWealth>

    beforeAll(async () => {
      app = await startRmqServiceWithWealth(
        {
          "port": undefined,
          "prefix": ""
        },
        rmqOpts,
        EmptyModule
      )

      await sleep(3000)
    })
    afterAll(async () => await app.close())

    it("no server", async () => {
      // const controller = new AbortController()
      // setTimeout(() => controller.abort(), 1000)

      let err = undefined
      try {
        await fetch(`${baseUrl}`, {
          //@ts-ignore
          // "signal": controller.signal
        })
      } catch (e) {
        err = e
      }

      expect(`${err}`).toMatch("ECONNREFUSED")
    })
  })
})

describe(RmqHandler.name, () => {
  const rmqOpts = {
    ...rmqOptsBase,
    "queue": "nest-test-handler",
    "noAck": false
  } as const
  , {queue} = rmqOpts

  describe("simple", () => {
    const payloads: unknown[] = []
    class Controller {
      logger = console

      @RmqHandler
      async run(payload: unknown) {
        payloads[0] = payload
        return `run ${payload}`
      }
    }

    @Module({
      "controllers": [Controller]
    }) class MyModule {}

    let app: Return<typeof startRmqService>
    , client: ClientRMQ

    beforeAll(async () => app = await startRmqService(MyModule, rmqOpts))
    beforeAll(async () => await (client = new ClientRMQ(rmqOpts)).connect())
    afterAll(async () => await client.close())
    afterAll(async () => await app.close())

    it("send", async () => {
      expect({
        "res": await client.send("run", "send").toPromise(),
        payloads
      }).toStrictEqual({
        "res": {
          "success": true,
          "data": "run send"
        },
        "payloads": ["send"]
      })
    })

    it("emit", async () => {
      expect({
        "res": await client.emit("run", "emit").toPromise(),
        payloads
      }).toStrictEqual({
        "res": undefined,
        "payloads": ["emit"]
      })
    })

    it("Explicit method call", async () => expect(
      await app.get(Controller).run("explicit")
    ).toStrictEqual({
      "success": true,
      "data": "run explicit"
    }))

    describe("404", () => {
      it("send to 404", async () => await expect(() => 
        rmqSend(client, "404", 1)
      ).rejects.toStrictEqual(
        ERROR_404
      ))

      it("emit to 404", async () => expect(
        await rmqEmit(client, "404", 1)
      ).toBe(
        true
      ))

      it("After 10 seconds", async () => {
        await sleep(10000)

        expect(
          await app.server.channel.checkQueue(queue)
        ).toStrictEqual({
          "consumerCount": 1,
          // It may be senseless check - rabbit gives info for specific consumer (i.e. without nacked by that one) and this publisher more-like considered as same source as consumer
          "messageCount": 0,
          "queue": queue
        })
      })
    })
  })
  
  describe("timeout", () => {
    const ticks: unknown[] = []
    beforeEach(() => ticks.length = 0)

    class Controller {
      logger = console
  
      TIMEOUT = 2500

      @RmqHandler
      async run({max, signal = idfn}: WithLogger<{"max": number}>) {
        
        for (let i = 0; i < max; i++) {
          await sleep(1000)
          ticks.push(i)

          signal.throwIfAborted?.()
        }

        return ticks.length
      }
    }
  
    @Module({
      "controllers": [Controller]
    }) class MyModule {}
    
    let app: Return<typeof startRmqService>
    , client: ClientRMQ
  
    beforeAll(async () => app = await startRmqService(MyModule, rmqOpts))
    beforeAll(async () => {
      client = new ClientRMQ(rmqOpts)
      await client.connect()
    })
    afterAll(async () => await client.close())
    afterAll(async () => await app.close())
    

    it("time outed", async () => {
      const r = await client.send("run", {"max": 5}).toPromise()
      
      await sleep(1500)

      expect({r, ticks}).toMatchObject({
        "ticks": [0, 1, 2],
        "r": {
          "success": false,
          "data": {
            "messageType": "AbortError"
          }
        }
      })
    })
    

    it("time ok", async () => {
      const r = await client.send("run", {"max": 2}).toPromise()
      
      await sleep(1500)

      expect({r, ticks}).toMatchObject({
        "ticks": [0, 1],
        "r": {
          "success": true,
          "data": 2
        }
      })
    })
  })
})

describe(RmqClient.name, () => {
  const rmqOpts = {
    ...rmqOptsBase,
    "queue": "test-nest-priority",
    "noAck": false,
    "queueOptions": {
      ...rmqOptsBase.queueOptions,
      "maxPriority": 10
    },
    "prefetchCount": 2
    
  } as const
  , {queue} = rmqOpts
  , payloads: unknown[] = []

  type Interface = {
    "run": <T extends {
      "m": unknown
      "duration"?: number
  }>(payload: T) => Promise<{"run": T}>
  }

  class Controller {
    logger = console

    @RmqHandler
    async run(payload: Arg0<Interface["run"]>) {
      payloads.push(payload)

      const {duration} = payload

      duration && await sleep(duration)

      return {"run": payload}
    }
  }

  @Module({
    "controllers": [Controller]
  }) class MyModule {}


  class Api extends RmqClient<Interface> {
    @Inject(queue) client!: RmqClient<Interface>["client"]
  }

  @RmqApiModule(rmqOpts, Api)
  class External {}

  let app: Return<typeof startRmqService>
  , ext: TestingModule
  , client: Api

  beforeAll(async () => app = await startRmqService(MyModule, rmqOpts))
  beforeAll(async () => {
    ext = await createTestModule(External)
    client = ext.get(Api)
  })
  afterAll(async () => {
    // await client.client.close()
    await ext.close()
  })
  afterAll(async () => {
    await sleep(500)
    await app.close()
  })

  it("Repeated send", async () => {
    payloads.length = 0

    const run1 = client.send.run
    , run2 = client.send.run
    , res = await client.send.run({"m": "send"})

    expect(run1).toBe(run2)

    expect({
      "type": typeof run1,
      res,
      payloads,
    }).toStrictEqual({
      "type": "function",
      "res": {"run": expect.objectContaining({"m": "send"})},
      "payloads": [expect.objectContaining({"m": "send"})]
    })
  })

  it("Repeated emit", async () => {
    payloads.length = 0
    
    const run1 = client.emit.run
    , run2 = client.emit.run
    , res = await client.emit.run({"m": "emit"})

    await sleep(100)

    expect(run1).toBe(run2)

    expect({
      "type": typeof run1,
      res,
      payloads,
    }).toStrictEqual({
      "type": "function",
      "res": true,
      "payloads": [expect.objectContaining({"m": "emit"})]
    })
  })

  it("GLBA-1304 Priority demo", async () => {
    payloads.length = 0
    
    const duration = 200

    await Promise.all([
      sleep(0).then(() => client.send.run({"m": null, duration})),
      sleep(0).then(() => client.send.run({"m": null, duration})),
      // Consumer capped
      sleep(0).then(() => client.send.run({"m": null, duration})),
      sleep(50).then(() => client.send.run({"m": 0, duration}, {"priority": 0})),
      sleep(100).then(() => client.send.run({"m": 1, duration}, {"priority": 1})),
      sleep(150).then(() => client.send.run({"m": 2, duration}, {"priority": 2}))
    ])

    expect({payloads}).toMatchObject({
      "payloads": [
        {"m": null},
        {"m": null},
        {"m": 2},
        {"m": 1},
        {"m": null},
        {"m": 0},
      ]
    })
  })

  it("GLBA-1304 Priority blocking", async () => {
    payloads.length = 0
    
    const duration = 200
    , count = 10
    , payloading = (i: number) => ({"m": `1#${i}`, duration})

    await Promise.all([
      sleep(0).then(() => client.send.run({"m": "0#0", duration})),
      sleep(0).then(() => client.send.run({"m": "0#1", duration})),
      // Consumer capped
      sleep(0).then(() => client.send.run({"m": "0#2", duration})),
      ...fill(count, i => sleep(100 * (i + 1)).then(() => client.send.run(payloading(i), {"priority": 1})))
    ])

    expect({payloads}).toMatchObject({
      "payloads": [
        {"m": "0#0"},
        {"m": "0#1"},
        ...fill(count, payloading),
        {"m": "0#2"}
      ]
    })
  })


})