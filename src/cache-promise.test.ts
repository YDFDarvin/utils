import { fill } from "./array";
import { sleep } from "./async";
import { CachePromise } from "./cache-promise";

describe(CachePromise.name, () => {
  let acc: number[] = []

  const frame = 50
  , ttl = 1000
  , maxCount = 5
  , resetCount = 3
  , cache = new CachePromise({
    frame,
    ttl,
    maxCount,
  }, {
    async checksum(k: number) {
      const v = acc[k] = (acc[k] ?? -1) + 1

      await sleep(frame)

      return Math.floor(v / resetCount)
    },
    async get(k) {
      await sleep(200) 
      return {k}
    }
  })

  beforeEach(() => acc.length = 0)

  it("frame", async () => {
    const length = 8

    let results: unknown[] = []

    for (let i = length; i-->0;) {
      await sleep(frame / (1.5 * length))
      results.push(cache.get(0))
    }

    results = await Promise.all(results)

    expect({
      "length": results.length,
      "size": new Set(results).size
    }).toStrictEqual({
      length,
      "size": 1
    })
  })

  it("ttl", async () => {
    const r1 = await cache.get(0)
    await sleep(0.9 * ttl)
    const r1_2 = await cache.get(0, {maxCount, ttl})
    await sleep(1.1 * ttl)
    const r2 = await cache.get(0)

    expect({
      "r": r2,
      "reused_no_frame": r1_2 === r1,
      "reused": r2 === r1
    }).toStrictEqual({
      "r": r1,
      "reused_no_frame": true,
      "reused": false
    })
  })

  it("reuse", async () => {
    const results: unknown[] = []
    , usage = new Map<any, number>()

    for (let i = 2 * resetCount - 1; i-->0;) {
      const k = await cache.get(0)
      , v = usage.get(k) ?? 0

      await sleep(frame)

      usage.set(k, v + 1)
      results.push(k)
    }

    expect({
      "length": results.length,
      "size": usage.size,
      "entries": Array.from(usage.values()),
      //@ts-ignore
      "reuseChain": fill(results.length - 1, i =>
        results[i + 1] === results[i]
      )
    }).toStrictEqual({
      "length": 5,
      "size": 2,
      "entries": [resetCount, resetCount - 1],
      "reuseChain": [
        ...fill(resetCount - 1, true),
        false,
        ...fill(resetCount - 2, true),
      ]
    })
  })

  it("maxCount", async () => {
    for (let i = 0; i < maxCount; i++)
      await cache.get(i)

    await cache.get(0)
    await cache.get(100)

    expect(
      Array.from(cache.cached.keys())
      .sort((a, b) => a - b)
    ).toStrictEqual([
      0,
      ...fill(maxCount - 2, i => i + 2),
      100
    ])
  })

  it("maxCount parallel", async () => {
    await Promise.all([0, maxCount].map(async start => {
      for (let i = 0; i < maxCount; i++)
        await cache.get(start + i)
    }))

    expect(
      Array.from(cache.cached.keys())
      .sort((a, b) => a - b)
    ).toStrictEqual([
      ...fill(Math.floor(maxCount / 2), i => i + Math.ceil(maxCount / 2)),
      ...fill(Math.ceil(maxCount / 2), i => maxCount + i + Math.floor(maxCount / 2)),
    ])
  })


  it("size and clear", async () => {
    cache.clear()
    const size0 = cache.size
    await cache.get(0)
    const size1 = cache.size

    expect([size0, size1]).toStrictEqual(
      [0, 1]
    )
  })
})
