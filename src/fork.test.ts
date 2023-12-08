import { forkTs, stopCp } from "./fork"
import { pick } from "./object"

let cp: ReturnType<typeof forkTs>

const pickStats = () => pick(cp, ["pid", "killed", "exitCode", "connected", "signalCode"])

describe("scenario", () => {
  let firstStats: ReturnType<typeof pickStats>

  describe("on interruption", () => {
    it(`1. ${forkTs.name}`, () => {
      cp = forkTs(require.resolve("./fork.testing"))
  
      expect(firstStats = pickStats()).toStrictEqual({
        "connected": true,
        "killed": false,
        "pid": expect.any(Number)
      })
    })
  
    it(`2. ${stopCp.name}`, async () => {
      const before = pickStats()
      await stopCp(cp)
      const after = pickStats()
  
      expect({before, after}).toStrictEqual({
        "before": firstStats,
        "after": {
          "connected": false,
          "killed": true,
          "pid": firstStats.pid,
          "signalCode": "SIGTERM"
        }
      })
    })
  
    it(`3. duplicated ${stopCp.name}`, async () => {
      const before = pickStats()
      await stopCp(cp)
      const after = pickStats()
  
      expect({before, after}).toStrictEqual({
        "before": {
          "connected": false,
          "killed": true,
          "pid": firstStats.pid,
          "signalCode": "SIGTERM"
        },
        "after": before
      })
    })
  })

  describe("own exit", () => {
    beforeAll(() => cp = forkTs(require.resolve("./fork.testing")))

    it("stats of own exit", async () => {
      await new Promise<unknown>(res => cp.once("close", res))

      const stats = pickStats()

      expect(stats).toStrictEqual({
        "connected": false,
        "exitCode": 0,
        "killed": false,
        "pid": expect.any(Number)
      })
    })

    it(stopCp.name, async () => {
      await stopCp(cp)
    })
  })
})
