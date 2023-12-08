import { Module } from "@nestjs/common";
import { ClientRMQ } from "@nestjs/microservices";
import { sleep } from "./async";
import { rmqUrl } from "./config";
import { Liveness } from "./liveness.decorator";
import { RmqController, RmqOpts, startRmqService } from "./nest";
import { rmqSend } from "./rmq";
import type { Return } from "./ts-utils.types";

const rmqOptsBase: Omit<RmqOpts, "queue"> = {
  "urls": [rmqUrl],
  "queueOptions": {
    "durable": false,
  },
  "persistent": true,
}

describe(Liveness.name, () => {
  const livelessMsg = "liveless"
  let alive: boolean = false

  let client: ClientRMQ
  , rmqService: Return<typeof startRmqService>
  , withLiveness: ServiceWithLiveness

  @RmqController
  class ControllerWithLiveness {
    onModuleInit() {
      console.log("onModuleInit")
    }

    async liveness() {
      if (!alive)
        throw Error(livelessMsg)
    }

    //TODO Check why @RmqHandler doesn't work
    async controller() {
      return 'ok';
    }
  }

  @Liveness
  class ServiceWithLiveness {
    onModuleDestory() {}

    async liveness() {
      if (!alive)
        throw Error(livelessMsg)
    }

    //TODO Check why @RmqHandler doesn't work
    async service() {
      return 'ok';
    }
  }

  const rmqTestOpts = {
    ...rmqOptsBase,
    "queue": "nest-test-liveness",
    "noAck": false
  }

  beforeAll(async () => {  
    @Module({
      "controllers":[ControllerWithLiveness],
      "providers": [ServiceWithLiveness]
    })
    class TestLivenessModule {}
    rmqService = await startRmqService(TestLivenessModule, rmqTestOpts)
    client = new ClientRMQ(rmqTestOpts)

    await client.connect()

    withLiveness = await rmqService.get(ServiceWithLiveness);
  });

  afterAll(async () => { await sleep(1000); await client.close() })
  afterAll(async () => { await sleep(1000); await rmqService.close() })

  describe(ControllerWithLiveness.name, () => {
    it('not ok', async () => {
      alive = false
      await expect(rmqSend(client, "controller", {
        "trace": "not-ok."
      }))
      .rejects.toThrow(livelessMsg)
    });
  
    it('ok', async () => {
      alive = true
      expect(await rmqSend(client, "controller", {
        "trace": "ok."
      }))
      .toBe('ok')
    });  
  })


  describe(ServiceWithLiveness.name, () => {
    it('not ok', async () => {
      alive = false
      await expect(withLiveness.service())
      .rejects.toThrow(livelessMsg)
    });
  
    it('ok', async () => {
      alive = true
      expect(await withLiveness.service()).toBe('ok')
    });  
  })
});
