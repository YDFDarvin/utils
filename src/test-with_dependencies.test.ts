import { pick } from "./object"
import { withDependencies } from "./test-with_dependencies"
import type { Dict } from "./ts-utils.types"

describe(withDependencies.name, () => {
  const DEPS_DIR = `${__filename.replace(/\.[^\\]*$/, "")}/`

  describe("deps off", () => {
    const cps = withDependencies()
  
    it("deps off", () => expect(cps).toBe(undefined))
  })

  describe("deps on", () => {
    const cps = withDependencies({
      "DEPS_WITH": true,
      "DEPS_CONFIG": `${DEPS_DIR}dependencies.list`,
      DEPS_DIR,
      "METRICS_PORT": 9090
    })

    it("check", async () => {
      const stdouts: Dict<string> = {}
      , stops: Promise<unknown>[] = []
      , stats: Dict<unknown> = {}

      for (const path in cps) {
        const key = path.replace(/^.*\//, "")
        , cp = cps[path]

        stdouts[key] = ""

        cp.stdout?.on("data", chunk => stdouts[key] += `${chunk}`)

        stops.push(new Promise<void>(res => cp.once("close", res)))
      }

      await Promise.all(stops)

      for (const path in cps) {
        const key = path.replace(/^.*\//, "")
        stats[key] = pick(cps[path], ["connected", "killed", "exitCode", "signalCode"])
      }

      expect({stats, stdouts}).toStrictEqual({
        "stdouts": {
          "dep1": "dep1\n",
          "dep2": "dep2\n"
        },
        "stats": {
          "dep1": {
            "connected": false,
            "exitCode": 0,
            "killed": false,
          },
          "dep2": {
            "connected": false,
            "exitCode": 0,
            "killed": false,
          },          
        }
      })
    })
  })
})
