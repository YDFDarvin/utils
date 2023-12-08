import { fill } from "./array"
import {
  $all,
  abortize,
  afterImmediate,
  afterTick,
  bulkRead,
  collect2map,
  getIteredValue,
  limit,
  makeAbort,
  makeRunner,
  parallel,
  repeatedly,
  sequence,
  sleep,
  toArray,
  waitFor,
  yieldPromises
} from "./async"
import { timer } from "./durate"
import { invoke } from "./fn"
import { minmax } from "./math"

describe(bulkRead.name, () => {
  it("demo", async () => {
    const bulks: number[][] = []

    for await (const bulk of bulkRead(
      3,
      [1, 2, 3, 4, 5]
    ))
      bulks.push(bulk)

    expect(bulks).toStrictEqual([
      [1, 2, 3],
      [4, 5]
    ])
  })
})

describe($all.name, () => {
  it("demo", async () => expect(await $all({
    "1": new Promise<number>(res => res(1)),
    "a": new Promise<string>(res => res("a")),
    //@ts-expect-error
    "done": {}
  })).toStrictEqual({
    "1": 1,
    "a": "a",
    "done": {}
  }))
})

it("Node loop", async () => {
  const stdout: string[] = [] 

  await Promise.all([
    afterImmediate().then(() => stdout.push("afterImmidiate")),
    afterTick().then(() => stdout.push("afterTick")),
  ])

  expect(stdout).toStrictEqual([
    "afterTick",
    "afterImmidiate"
  ])
})

describe(collect2map.name,  () => {
  it("Omit key", async () => expect(await collect2map(
    [
      {"id": "1", "value": "a"}, 
      {"id": "2", "value": "b"}
    ],
    //@ts-expect-error
    "id",
    false
  )).toStrictEqual({
    "1": {"value": "a"},
    "2": {"value": "b"}
  }))

  it("Keep key", async () => expect(await collect2map(
    [
      {"id": "1", "value": "a"}, 
      {"id": "2", "value": "b"}
    ],
    //@ts-expect-error
    "id",
    true
  )).toStrictEqual({
    "1": {"id": "1", "value": "a"}, 
    "2": {"id": "2", "value": "b"}
  }))

  it("Rename key", async () => expect(await collect2map(
    [
      {"id": "1", "value": "a"}, 
      {"id": "2", "value": "b"}
    ],
    //@ts-expect-error
    "id",
    "_id"
  )).toStrictEqual({
    "1": {"_id": "1", "value": "a"}, 
    "2": {"_id": "2", "value": "b"}
  }))

  it("array behavior", async () => expect(await collect2map(
    [
      {"id": 1, "value": ["a", "b"]},
      {"id": 1, "value": ["c", "d"]},
      {"id": 1, "value": ["e", "f"]},
    ],
    //@ts-expect-error
    "id"
  )).toStrictEqual({
    "1": [
      {"value": ["a", "b"]},
      {"value": ["c", "d"]},
      {"value": ["e", "f"]}
    ]
  }))
})

describe(waitFor.name, () => {
  it("demo", async () => {
    let passed = false
    setTimeout(() => passed = true, 500)

    expect(await waitFor(
      () => passed,
      {
        "interval": 10,
        "maxCalls": 3
      }
    )).toBe(false)

    expect(await waitFor(
      () => passed,
      {
        "interval": 10,
        "maxCalls": 100
      }
    )).toBe(true)
  })
})

describe(abortize, () => {
  it("double", async () => {
    let i = 0

    async function* sleeper() {
      while (i < 5) {
        await sleep(500)
        yield i++
      }
    }

    const controller = new AbortController()

    setTimeout(() => controller.abort(), 750)

    for await (const _ of abortize(controller.signal, sleeper())) {}

    expect(i).toBe(2)
  })
})

describe(parallel.name, () => {
  async function* gen0() {
    yield 0.1
    yield 0.2
    yield 0.3
  }

  async function* gen1() {
    await sleep(250)
    yield 1
    await sleep(500)
    yield 3
    await sleep(500)
    yield 5
  }

  async function* gen2() {
    await sleep(500)
    yield 2
    await sleep(500)
    yield 4
    await sleep(500)
    yield 6
  }

  async function* genErr() {
    await sleep(500)
    yield -1
    await sleep(500)
    throw new Error()
  }

  it("instant", async () => expect(
    await toArray(parallel([gen1(), gen2(), gen0()]))
  ).toStrictEqual([
    0.1, 0.2, 0.3,
    1, 2, 3, 4, 5, 6
  ]))

  it("delayed", async () => {
    const collected = []

    for await (const item of parallel([gen1(), gen2(), gen0()])) {
      collected.push(item)
      await sleep(100)
    }

    expect(collected).toStrictEqual([
      0.1, 0.2, 0.3,
      1, 2, 3, 4, 5, 6
    ])
  })

  it("abortize", async () => {
    const collected = []
    , {controller, signal} = makeAbort()

    setTimeout(() => controller.abort(), 625)
    
    for await (const item of signal(parallel([gen1(), gen2()]))) 
      collected.push(item)

    expect(collected).toStrictEqual([
      1, 2
    ])
  })

  it("internal throw", async () => {
    const collected = []

    try {
      for await (const item of parallel([gen1(), genErr()])) {
        collected.push(item)
      }
    } catch (_) {}

    expect(collected).toStrictEqual([
      1, -1, 3
    ])
  })
})

it(sequence.name, async () => {
  async function* gen() {
    yield 1
    await sleep(10)
    yield 2
  }

  expect(await toArray(sequence([gen(), gen()]))).toStrictEqual([
    1, 2, 1, 2
  ])
})

it(repeatedly.name, async () => expect(await repeatedly(
  3, async () => "!"
)).toStrictEqual([
  "!", "!", "!"
]))

describe(getIteredValue.name, () => {
  it("just value", () => expect(getIteredValue({
    "a": 1
  })).toStrictEqual({
    "a": 1
  }))

  it("null", () => expect(getIteredValue(
    null
  )).toBe(null))

  it("primitive", () => expect(getIteredValue(
    "a"
  )).toBe("a"))

  it("from gen*", () => {
    function* gen() {
      yield 1
    }
    
    const value = getIteredValue(gen().next())

    expect(value).toBe(1)
  })

  it("iterator protocol fake", () => expect(getIteredValue({
    "done": "abc"
  })).toStrictEqual({
    "done": "abc"
  }))
})

describe.skip(yieldPromises.name, () => {
  it("instant resolve", async () => {
    const result = []

    for await (const val of yieldPromises([
      invoke(async () => -2),
      invoke(async () => -1),
      sleep(0).then(() => 0),
      sleep(200).then(() => 2),
      sleep(100).then(() => 1),
    ]))
      result.push(val)

    expect(result).toStrictEqual([-2, -1, 0, 1, 2])
  })

  it("delayed resolve", async () => {
    const result = []

    for await (const val of yieldPromises([
      sleep(0).then(() => 0),
      sleep(200).then(() => 2),
      sleep(100).then(() => 1),
    ])) {
      await sleep(150)
      result.push(val)
    }

    expect(result).toStrictEqual([0, 1, 2])
  })

  it("close", async () => {
    const prom = yieldPromises([
      sleep(0).then(() => 0),
      sleep(200).then(() => 2),
      sleep(100).then(() => 1),
    ])

    const vals = [
      await prom.next(),
      await prom.return(),
      await prom.next(),
    ]

    expect(vals).not.toStrictEqual([
      {"value": 0},
      {"done": true, "value": undefined},
      {"done": true, "value": undefined}
    ])


    expect(vals).toStrictEqual([
      {"value": 0},
      {"done": true, "value": undefined},
      {"value": 1},
    ])
  })
})

describe(limit.name, () => {
  it("demo", async () => {
    const acc: number[] = []

    async function* gen (){
      for (let i = 0; i < 5; i++) {
        await sleep(10)
        acc.push(i)
        yield i
      }
    }

    const cursor = gen()
    , limited = await toArray(limit(3, cursor))
    , after = await cursor.next()

    expect({limited, after, acc}).toStrictEqual({
      "limited": [0, 1, 2],
      "after": {"done": true, "value": undefined},
      "acc": [0, 1, 2],
    })
  })

  it("interrupt", async () => {
    const acc: number[] = []

    async function* gen (){
      for (let i = 0; i < 5; i++) {
        await sleep(10)
        acc.push(i)
        yield i
      }
    }

    const cursor = limit(3, gen())

    let counter = 0
    for await (const _ of cursor)
      if (++counter >= 2)
        await cursor.return()  

    const after = await cursor.next()

    expect({counter, after, acc}).toStrictEqual({
      "counter": 2,
      "after": {"done": true, "value": undefined},
      "acc": [0, 1],
    })
  })

  it("throw", async () => {
    const acc: number[] = []

    async function* gen (){
      for (let i = 0; i < 5; i++) {
        await sleep(10)
        acc.push(i)
        yield i
      }
    }

    const cursor = gen()
    , limited = limit(3, cursor)
    , err = new Error()

    let counter = 0
    , caught = undefined

    try {
      for await (const _ of limited)
        if (++counter >= 2)
          await limited.throw(err)  
    } catch (e) {
      caught = e
    }

    const after = await cursor.next()

    expect({counter, caught, after, acc}).toStrictEqual({
      "counter": 2,
      "caught": err,
      "after": {"done": true, "value": undefined},
      "acc": [0, 1],
    })
  })
})

describe(makeRunner.name, () => {
  it("sync", async () => {
    const source = fill(9, i => i)
    , runner = makeRunner(source, async i => (
      await sleep(100),
      -i
    ))
    , runners = fill(3, runner)
    , end = timer()
    , result = await toArray(parallel(runners))
    , duration = end()

    expect({result, duration}).toStrictEqual({
      //@ts-ignore
      "result": fill(9, i => -i),
      "duration": minmax(duration, 250, 350)
    })
  })

  it("async", async () => {
    async function* gen() {
      for (let i = 0; i < 9; i++) {
        await sleep(25)

        yield i
      }
    }

    const source = gen()
    , runner = makeRunner(source, async i => (
      await sleep(70),
      -i
    ))
    , runners = fill(3, runner)
    , end = timer()
    , result = await toArray(parallel(runners))
    , duration = end()

    expect({result, duration}).toStrictEqual({
      //@ts-ignore
      "result": fill(9, i => -i),
      "duration": minmax(duration, 250, 350)
    })
  })
})
