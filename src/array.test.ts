import {
  arrayize,
  ascNumSort,
  fill,
  first,
  fromForEach,
  shrink,
  shuffle,
  sort,
  unflat,
  unflatByChars,
  unflatForEach,
  unique
} from "./array";
import type { Dict } from "./ts-utils.types";

describe(fill.name, () => {
  it("scalar", () => expect(fill(
    2, "x"
  )).toStrictEqual(
    ["x", "x"]
  ))

  it("fn", () => expect(fill(
    //@ts-ignore Weird...
    2, i => i
  )).toStrictEqual(
    [0, 1]
  ))

  it("ts", () => {
    const x = (() => 1) as "str" | (() => 1)
    , filled = fill(2, x)
    , tsCheck: typeof filled = [
      "str",
      1,
      //@ts-expect-error
      "string",
      //@ts-expect-error
      2,
    ]

    expect(tsCheck).toBeInstanceOf(Array)
  })
})

describe(unflat.name, () => {
  it("5 / 3", () => expect(unflat(
    3,
    [1, 2, 3, 4, 5]
  )).toStrictEqual([
    [1, 2, 3],
    [4, 5]
  ]))

  it("6 / 3", () => expect(unflat(
    3,
    [1, 2, 3, 4, 5, 6]
  )).toStrictEqual([
    [1, 2, 3],
    [4, 5, 6]
  ]))

  it("7 / 3", () => expect(unflat(
    3,
    [1, 2, 3, 4, 5, 6, 7]
  )).toStrictEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7]
  ]))

  it("9 / 4", () => expect(unflat(
    4,
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  )).toStrictEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ]))
})

describe(unflatForEach.name, () => {
  it("empty map", () => expect(unflatForEach(2, new Map())).toStrictEqual([]))

  it("demo set", () => expect(unflatForEach(
    3, new Set([1, 2, 3, 4, 5, 6, 7, 8]))
  ).toStrictEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8]
  ]))

  it("demo array", () => expect(unflatForEach(
    3, [1, 2, 3, 4])
  ).toStrictEqual([
    [1, 2],
    [3, 4],
  ]))

  it("forEach only", () => expect(unflatForEach(3, {
    forEach: [].forEach.bind([1, 2, 3, 4]),
  })).toStrictEqual([
    [1, 2, 3],
    [4]
  ]))
})

describe(unflatByChars.name, () => {
  it("empty", () => expect(unflatByChars(3, new Set<string>())).toStrictEqual([]))

  it("demo", () => expect(unflatByChars(
    5, ["ab", "cd", "ef", "abcdef", "abc", "de"]
  )).toStrictEqual([
    ["ab", "cd"],
    ["ef"],
    ["abcdef"],
    ["abc", "de"]
  ]))

  it("instant exception", () => expect(unflatByChars(
    5, ["abcdef", "abc", "de"]
  )).toStrictEqual([
    ["abcdef"],
    ["abc", "de"]
  ]))
})

describe(arrayize.name, () => {
  it("undefined", () => expect(arrayize(undefined)).toStrictEqual(undefined))

  it("scalar", () => expect(arrayize(1)).toStrictEqual([1]))
  
  it("array", () => {
    const arr = [1]
    expect(arrayize(arr)).toBe(arr)
  })

  it("ts", () => {
    const x = [0] as number[]|string
    , $return = arrayize(x)[0]
    , tsAssert: Dict<typeof $return> = {
      "number": 0,
      "string": "0",
      //@ts-expect-error
      "boolean": true
    }

    tsAssert
  })
})

describe(ascNumSort.name, () => {
  it("demo", () => expect(
    [10, 1, 100]
    .sort(ascNumSort)
  ).toStrictEqual([
    1, 10, 100
  ]))
})

describe(sort.name, () => {
  it("demo", () => expect(sort(shuffle([
    {"a": 1, "b": 1, "i": 1},
    {"a": 1, "b": 2, "i": 2},
    {"a": 0, "b": 1, "i": 3},
    {"a": 0, "b": 0},
    {"a": 0, "b": 0}
  ]), {
    //@ts-expect-error
    "i": 0,
    "a": 1,
    "b": -1,
  })).toStrictEqual([
    {"a": 0, "b": 1, "i": 3},
    {"a": 0, "b": 0},
    {"a": 0, "b": 0},
    {"a": 1, "b": 2, "i": 2},
    {"a": 1, "b": 1, "i": 1},
  ]))

  it("with no key, null", () => expect(sort(shuffle([
    {},
    {"p2": 1},
    {"p1": 1},
    {"p1": null, "p2": null},
    {"p1": null, "p2": 1},
    {"p1": 1, "p2": null},
    {"p1": 1, "p2": 1},
  ]), {
    "p1": 1,
    "p2": 1
  })).toStrictEqual([
    {},
    {"p2": 1},
    {"p1": null, "p2": null},
    {"p1": null, "p2": 1},
    {"p1": 1},    
    {"p1": 1, "p2": null},
    {"p1": 1, "p2": 1},
  ]))

  it("falsy values", () => expect(sort(shuffle([
    {},
    {"v": undefined},
    {"v": null},
    {"v": false},
    {"v": ""},
    {"v": 0},
  ]), {
    "v": 1
  })).toStrictEqual([
    {},
    {"v": undefined},
    {"v": null},
    {"v": 0},
    {"v": ""},
    {"v": false},
  ]))
})

describe(unique.name, () => {
  it("demo", () => expect(unique([
    3, 2, 1, 2, 1, 2
  ])).toStrictEqual([
    3, 2, 1
  ]))
})

describe(shrink.name, () => {
  it("do nothing", () => expect(shrink(
    [1, 2]
  )).toStrictEqual(
    [1, 2]
  ))

  it("do nothing", () => expect(shrink(
    [1, 2, 3]
  )).toStrictEqual(
    [1, 2, 3]
  ))

  it("tail", () => expect(shrink(
    [1, 2, 3, , , , ]
  )).toStrictEqual(
    [1, 2, 3]
  ))

  it("head", () => expect(shrink(
    [, , , 1, 2, 3]
  ).sort()).toStrictEqual(
    [1, 2, 3]
  ))

  it("mid", () => expect(shrink(
    [, , , 1, 2, 3, , , ,]
  ).sort()).toStrictEqual(
    [1, 2, 3]
  ))

  it("many gaps", () => expect(shrink(
    [, , 1, 2, , 3, , 4, 5, ,]
  ).sort()).toStrictEqual(
    [1, 2, 3, 4, 5]
  ))

  it("many gaps", () => expect(shrink(
    [, , 1, 2, , 3, , 4, 5, ,]
  )).toStrictEqual(
    [5, 4, 1, 2, 3]
  ))
})

it(first.name, () => expect(first(
  [1, 2, 3]
)).toBe(1))

describe(fromForEach.name, () => {
  it("from Set", () => expect(fromForEach(
    new Set([1, 2, 3])
  )).toStrictEqual(
    [1, 2, 3]
  ))

  it("from Map", () => expect(fromForEach(
    new Map(Object.entries({
      "a": 1,
      "b": 2,
      "c": 3,
    }))
  )).toStrictEqual(
    [1, 2, 3]
  ))

  it("from Set to other", () => expect(fromForEach(
    new Set([3, 4]),
    [1, 2]
  )).toStrictEqual(
    [1, 2, 3, 4]
  ))
})
