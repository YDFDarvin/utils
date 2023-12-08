import {
  idfn,
  invoke,
  isTruthy,
  nopPromise,
  pipe
} from "./fn"

describe(pipe.name, () => {
  it("demo", () => {
    const producer = () => pipe(
      1,
      a => a + 1,
      num => `${num}`
    )
    //@ts-expect-error is `string`
    , _: number = producer()
    , result: string = producer()

    expect(result).toBe("2")
  })
})

it(invoke.name, () => expect(invoke(
  () => 1
)).toBe(1))

describe(isTruthy.name, () => {
  it("demo", () => expect(
    [undefined, 1, 2]
    .filter(isTruthy)
    [0]
    * 1
  ).toBe(1))
})

it(idfn.name, () => {
  const arr = [1]
  expect(arr === idfn(arr)).toBe(true)
})

it(nopPromise.name, async () => {
  const prom = nopPromise()

  expect({prom, "awaited": await prom}).toStrictEqual({
    "prom": expect.any(Promise),
    "awaited": undefined
  })
})
