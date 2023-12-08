import { makeQueue, makeStack } from "./list";

describe(makeQueue.name, () => {
  it("demo", () => {
    const queue = makeQueue<number>()
    , expectation = [1, 2, 3]

    expectation.forEach(v => queue.push(v))

    const values: number[] = []

    const before = queue.length
    queue.forEach(v => values.push(v))
    const after = queue.length

    expect({
      values,
      "iter": Array.from(queue),
      before,
      after,
      "arrayed": queue.length
    }).toStrictEqual({
      "values": expectation,
      "iter": expectation,
      "before": expectation.length,
      "after": expectation.length,
      "arrayed": 0
    })
  })

  it("empty", () => {
    const queue = makeQueue<number>()
    , values: number[] = []
    queue.forEach(v => values.push(v))

    expect({
      "data": Array.from(queue),
      values,
      "length": queue.length
    }).toStrictEqual({
      "data": [],
      "values": [],
      "length": 0
    })
  })
})

describe(makeStack.name, () => {
  it("demo", () => {
    const stack = makeStack<number>()
    , expectation = [1, 2, 3]

    expectation.forEach(v => stack.push(v))

    const values: number[] = []

    stack.forEach(v => values.push(v))

    expectation.reverse()
    expect({
      values,
      "iter": Array.from(stack)}
    ).toStrictEqual({
      "values": expectation,
      "iter": expectation
    })
  })

  it("empty", () => {
    const stack = makeStack<number>()
    , values: number[] = []
    stack.forEach(v => values.push(v))

    expect({
      "data": Array.from(stack),
      values,
      "length": stack.length
    }).toStrictEqual({
      "data": [],
      "values": [],
      "length": 0
    })
  })
})