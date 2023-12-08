import {
  assignLogger,
  formatLog
} from './logger';
import type { WithLogger } from "./ts-utils.types";

const {parse: $parse, stringify: $stringify} = JSON

describe(assignLogger.name, () => {
  const req = {} as WithLogger<{}>
  , after = assignLogger(req)

  it("demo", () => req.trace!.log({
    "method": "method",
    "duration": 0
  }))

  it("check", () => {
    const keysForIn: string[] = []

    for (const k in req)
      keysForIn.push(k)

    expect(after).toBe(req)
    expect(Object.keys(req)).toStrictEqual(["trace"])
  })

  it("toJSON", () => expect(JSON.parse(JSON.stringify(
    req
  ))).toStrictEqual({
    "trace": expect.any(String)
  }))

  it("toString", () => expect(
    parseFloat(req.trace!.toString())
  ).toBeGreaterThan(
    Date.now() - 60 * 1000 
  ))

  it("toPrimitive", () => expect(
    parseFloat(`${req.trace}`)
  ).toBeGreaterThan(
    Date.now() - 60 * 1000 
  ))

  describe("logLevels", () => {
    const lines: unknown[] = []
    , {trace} = assignLogger({}, new Proxy({} as Console, {
      get: (_, _1) => (...args: unknown[]) => lines.push(...args)
    }))

    it("debug not for test", () => {
      trace!.debug({})
      const {length} = lines
      lines.length = 0

      expect(length).toBe(0)
    })

    it("bad params", () => {
      trace!.error(
        //@ts-expect-error
        null,
        "payload"
      )
      const lined = lines.concat()
      lines.length = 0

      expect(lined).toStrictEqual([
        expect.stringMatching(
          /^trace=[^\s]+ levelName=error message=null "payload"$/
        )
      ])
    })

    it("deep params", () => {
      trace!.error({"a": [0, 1], "u": undefined})
      const lined = lines.concat()
      lines.length = 0

      expect(lined).toStrictEqual([
        expect.stringMatching(
          /^trace=[^\s]+ levelName=error a=\[0,1\]$/
        )
      ])
    })
  })
})

describe(formatLog.name, () => {
  it("demo", () => {
    const payload = {
      "int": 1,
      "obj": {
        "l1": 1,
        "l2": {"a": 1, "b": 2},
        "arr": [1, 2, 3]
      },
      "array": [
        1,
        {"l1": 1},
        [1, 2, [3]]
      ]
    }
    , payloadClone = $parse($stringify(payload))
    , formatted = $parse(formatLog(payload, 1))
    
    expect({formatted, payload}).toStrictEqual({
      "formatted": {
        "int": 1,
        "obj": {
          "l1": 1,
          "l2": "[Object]",
          "arr": "[Array 3]",
        },
        "array": [
          1,
          "[Object]",
          "[Array 3]"
        ],
      },
      "payload": payloadClone
    })
  })

  it("array", () => expect($parse(formatLog([
    0, [1], [[2, 2]],
  ], 1))).toStrictEqual([
    0, [1], ["[Array 2]"]
  ]))

  it("atypical", () => {
    expect($parse(formatLog({
      "data": {
        "set": new Set([1, 2, 3]),
        "fn": () => {},
        "map": new Map([[1, 2], [3, 4]]),
        "item": new class Item {}
      }
    }, 1))).toStrictEqual({
      "data": {
        "set": "[Set 3]",
        "map": "[Map 2]",
        "item": "[Item]"
      }
    })
  })

  it("double apply", () => {
    const payload = {"a": {"b": {"c": "d"}}}
    , f1 = $parse(formatLog(payload.a, 1))
    , f2 = $parse(formatLog(payload, 1))
    
    expect({f1, f2}).toStrictEqual({
      "f1": {"b": {"c": "d"}},
      "f2": {"a": {"b": "[Object]"}}
    })
  })
})
