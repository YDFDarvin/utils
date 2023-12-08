import {
  ChildProcess,
  // exec,
  execSync
} from "child_process"
// import { promisify } from "util"
import { fill } from "../array"
import {
  sleep,
  waitFor
} from "../async"
import {
  forkTs,
  stopCp
} from "../fork"
import {
  NestRmqService,
  startRmqService
} from "../nest"
import { rmqEmit } from "../rmq"
import type {
  Logger
} from "../ts-utils.types"
import {
  rmqMain, rmqSub
} from "./config"
import {
  MainController,
  MainModule,
  received
} from "./main.app"
import { proxyNop } from "./proxy-nop"

execSync
// const $exec = promisify(exec)
// let client: ClientRMQ

let app: NestRmqService

// export {
//   $exec
// }

// beforeAll(async () => {
//   client = new ClientRMQ(rmqSub)

//   // TODO Investigate - 3 options. 1) nest's default; 2) nop for amqp; 3) manual reconnect with count
//   // client.handleDisconnectError = function handleDisconnectError(this: ClientRMQ, client: ClientRMQ) {
//   //   //@ts-ignore    
//   //   client.addListener("disconnect", () => {
//   //     console.log("! Disconnect")

//   //     setTimeout(() => {
//   //       console.log(". Connecting")
//   //       client.connect().then(
//   //       () => console.log("+ Connected"),
//   //       (e) => console.log("- Not connected", e)
//   //     )
//   //   }, rmqSub.socketOptions!.reconnectTimeInSeconds! * 1000)
//   //   });
//   // }

//   await client.connect()

//   //@ts-expect-error
//   ;(client.channel as ChannelWrapper).purgeQueue(rmqSub.queue)

// })
// afterAll(async () => client.close())

beforeAll(async () => {
  app = await startRmqService(MainModule, rmqMain, proxyNop<Logger>())
  await sleep(1000)
  await app.get(MainController).sub.client.channel!.purgeQueue(rmqSub.queue)
})
afterAll(async () => await app.close())

for (const instancesCount of [
  1,
  2
]) describe(`instances=${instancesCount}`, () => {
  const instances: ChildProcess[] = []

  beforeAll(() => fill(instancesCount, i => instances[i] = upSub()))
  afterAll(async () => await Promise.all(instances.map(instance => stopCp(instance))))

  Object.entries({
    "Good flow": {
      "emitDelay": 50,
      "consumerDelay": 200,
      "count": 100,
      "shouldReceive": 100,      
    },
    // GLBA-1081
    "Instance down": {
      "emitDelay": 50,
      "consumerDelay": 150,
      "count": 100,
      "shouldReceive": 100,      
      "down": async () =>
        await stopCp(instances[0])
      ,
      "up": async () => {
        instances[0] = upSub()
      }
    },
    "Instance kill": {
      "emitDelay": 50,
      "consumerDelay": 200,
      "count": 100,
      "shouldReceive": 100,      
      "down": async () =>
        await stopCp(instances[0], "SIGKILL")
      ,
      "up": async () => {
        instances[0] = upSub()
      }
    },
    "Rabbit stop": {
      "emitDelay": 100,
      "consumerDelay": 400,
      "count": 250,
      "shouldReceive": {
        "type": "integer",
        "minimum": 100
      },
      "down": async () =>
        execSync("docker-compose stop broker").toString()
      ,
      "up": async () =>
        execSync("docker-compose start broker").toString()
    },
    "Rabbit kill": {
      "emitDelay": 100,
      "consumerDelay": 400,
      "count": 250,
      "shouldReceive": {
        "type": "integer",
        "minimum": 100
      },
      "down": async () =>
        execSync("docker-compose kill -s SIGKILL broker").toString()
      ,
      "up": async () =>
        execSync("docker-compose up -d broker").toString()
    },
    // 404
    // heartbeat down
    // consumer timeout
  } as Record<string, {
    "count": number
    "emitDelay": number
    "consumerDelay": number
    "shouldReceive": (number & {
      "type"?: never
      "minimum"?: never
      "maximum"?: never
    }) | {
      "type": "integer"
      "minimum": number
      "maximum"?: number
    }
  } & ({
    "down"?: undefined
    "up"?: undefined
  } | {
    "down": () => Promise<unknown>,
    "up": () => Promise<unknown>
  })>)
  .forEach(([title, {
    count,
    emitDelay,
    consumerDelay,
    shouldReceive,
    down,
    up
  }]) => it(title, async () => {
    console.log(`x${instancesCount} ${title}`)
    // TODO check that queue is empty
    received.length = 0
    
    const trace = new Date().toJSON()
    , payloads = fill(count, i => ({i, trace}))
    , [sents] = await Promise.all([
      bulkEmit({
        "delay": emitDelay,
        "payloads": payloads.map(echo => ({
          echo,
          "emit": true,
          "delay": consumerDelay
        }))
      })
      .then(r => {
        console.log("emitted")
        return r
      }),      
      down && up && (async () => {
        await waitFor(() => received.length > 5, {"interval": 10, "maxCalls": 1000})
        console.log("down", await down())

        const was = received.length
        await sleep(500)
        const got = received.length

        console.log("up", await up())

        return {was, got}
      })()
    ])

    const waited = await waitFor(() =>
      received.length >= (shouldReceive.minimum ?? shouldReceive)
      && Math.max(...received.map(r => (r as {i: number}).i)) === count - 1, {
      "interval": emitDelay,
      "maxCalls": count
    })

    await sleep(1000)

    const receivedIds = Array.from(new Set(received.map(r => (r as {i: number}).i))).sort((a, b) => a - b)
    , sentIds = Array.from(new Set(sents.map(r => r.i))).sort((a, b) => a - b)

    expect({
      waited,
      "ids": receivedIds,
      "lastId": receivedIds.at(-1),
      ...typeof shouldReceive === "number" && {"received": receivedIds.length},
    }).toStrictEqual({
      "waited": true,
      "lastId": count - 1,
      ...typeof shouldReceive === "number" && {"received": shouldReceive},
      "ids": sentIds
    })

    if (typeof shouldReceive !== "number")
      expect(receivedIds.length).toMatchSchema(shouldReceive)
  }))
})

function upSub() {
  return forkTs(require.resolve("./sub.app"), {
    //@ts-expect-error
    "env": {
      ...process.env,
    },
    "silent": false
  })  
}

async function bulkEmit<T extends {"echo": unknown}>({
  delay,
  payloads
}: {
  "delay": number
  "payloads": T[]
}) {
  const sents: typeof payloads[number]["echo"][] = []

  let recovered: undefined|boolean = undefined

  await Promise.all(payloads.map(async (p, i) => {
    await sleep(i * delay)

    try { 
      const {
        client,
        "client": {"client": c, channel}}
      = app.get(MainController).sub

    // Debug point
      ;(() => ({c, channel}))()

      await rmqEmit(client, "run", p)

      sents.push(p.echo)

      if (recovered === false) {
        recovered = true
        console.log("Recovered: ", i)
      }
    } catch (e) {
      if (recovered === undefined) {
        recovered = false
        console.log("Down: ", i, e)
      }
    }
  }))

  return sents
}
