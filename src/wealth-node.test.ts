import { port } from "./config"
import { fetch } from "./fetch"
import { invoke } from "./fn"
import { forkTs } from "./fork"
import { start } from "./nest-check-testing"
import { pick } from "./object"
import type { Arg0, Fn, Return } from "./ts-utils.types"
import { wealthCheck } from "./wealth-client"
import { createWealth } from "./wealth-node"

const base = `http://localhost:${port}`

describe(createWealth.name, () => {
  describe("demo", () => {
    const totalHealthy = {
      "ok": true,
      "consumers": {
        "test-health": {
          "ok": true
        }
      },
      "dbs": {
        "test": {
          "test-health": {
            "ok": true
          }
        }
      },
      "publishers": {
        "test-health": {
          "ok": true
        }
      }
    }

    let app: Return<typeof start>
    , resume: Fn
    , appPromise: Arg0<typeof createWealth>
  
    invoke(() => {
      let server: ReturnType<typeof createWealth>
  
      beforeAll(() => {
        appPromise = new Promise(res => resume = res).then(async () => app = await start())
        server = createWealth(appPromise, {port})  
      })  
      afterAll(() => Promise.allSettled([
        app.close(),
        server.stop()
      ]))
    })
  
    it("health is ok instantly", async () => expect(
      await fetch({"url": `${base}/healthcheck`})
    ).toMatchObject({
      "status": 201
    }))
  
    it("Early liveness check", async () => expect(
      await fetch({"url": `${base}/liveness`})
    ).toMatchObject({
      "status": 425
    }))
  
    it("launch", async () => {
      resume()
      await appPromise
    })
  
    it("After start", async () => expect(
      await fetch({"url": `${base}/liveness`})
    ).toMatchObject({
      "status": 200,
      "data": {
        "ok": true
      }
    }))
  
    it("wealthCheck with bad port", () => expect(
      wealthCheck({
        //@ts-expect-error
        "port": "abc"
      })
    ).rejects.toThrow())

    it("After check with client", async () => expect(
      await wealthCheck({port})
      .then(({text}) => JSON.parse(text))
    ).toStrictEqual(totalHealthy))
  
    it("sub check", async () => expect(
      await fetch({"url": `${base}/liveness?dbs=1`})
      .then(r => r.data)
    ).toStrictEqual(
      pick(totalHealthy, ["ok", "dbs"])
    ))
  
    it("Metrics", async () => expect(
      await fetch({"url": `${base}/metrics`})
    ).toMatchObject({
      "status": 200,
      "text": "\n"
    }))

    it("Weird url", async () => expect(
      await fetch({"url": base})
    ).toMatchObject({
      "status": 404
    }))

    it("app", async () => {
      const r = forkTs(require.resolve("./wealth-client"), {
        "env": {"METRICS_PORT": port}
      })
      , chunks: string[] = []

      r.stdout?.on("data", c => chunks.push(`${c}`))
      
      await new Promise<unknown>(res => r.once("close", res))

      const resp = JSON.parse(chunks.join(""))

      expect(resp).toStrictEqual(
        totalHealthy
      )
    })
  })
})
