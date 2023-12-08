import { sleep } from "./async"
import { promOpts } from "./config"
import { durate } from "./durate"
import { assignLogger } from "./logger"
import { init } from "./prom-client"

beforeAll(() => {
  init(promOpts)
})

describe(durate.name, () => {
  const lines: unknown[] = []
  , {trace} = assignLogger({}, new Proxy({} as Console, {
    get: (_, _1) => (...args: unknown[]) => lines.push(...args)
  }))

  it("demo", async () => {
    const r = await durate(trace!, function some(x: number) {
      return sleep(100).then(() => x + 1)
    })(1)
    , lined = lines.concat()
    lines.length = 0

    expect({r, lined}).toStrictEqual({
      "r": 2,
      "lined": [
        expect.stringMatching(/^trace=[^\s]+ levelName=info fn=some duration=(1[0-9]{2}|99)(\.[0-9]+)?$/)
      ]
    })
  })

  it("on error", async () => {
    const r = await durate(trace!, function erroring() {
      return sleep(100).then(() => Promise.reject("bye"))
    })().catch(err => err)
    , lined = lines.concat()
    lines.length = 0

    expect({r, lined}).toStrictEqual({
      "r": "bye",
      "lined": [
        expect.stringMatching(/^trace=[^\s]+ levelName=info fn=erroring duration=(1[0-9]|9)[0-9](\.[0-9]+)?$/)
      ]
    })
  })

})