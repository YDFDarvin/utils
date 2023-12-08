import { serialize } from "bson"
import {
  $add,
  $addToSetLean,
  $allOf,
  $anyOf,
  $avg,
  $concatArrays,
  $count,
  $divide,
  $eq,
  $first,
  $gt,
  $gte,
  $in,
  $last,
  $lt,
  $lte,
  $max,
  $min,
  $multiply,
  $ne,
  $nin,
  $oneOf,
  $oneOrNull,
  $range,
  $sum,
  newAvg
} from "./group-ops"

describe("aggregation", () => {
  it($count.name, () => expect($count(
    //@ts-expect-error
    false, undefined
  )).toBe(
    1
  ))

  describe($range.name, () => {
    it("Same", () => expect($range(
      2, 2
    )).toBe(2))
  
    it("More", () => expect($range(
      2 as number, 3 as number
    )).toStrictEqual({
      "minimum": 2,
      "maximum": 3
    }))
  
    it("Less", () => expect($range(
      2 as number, 1 as number
    )).toStrictEqual({
      "minimum": 1,
      "maximum": 2
    }))
  
    it("In", () => expect($range(
      {"minimum": 2, "maximum": 4}, 3 as number
    )).toStrictEqual({
      "minimum": 2,
      "maximum": 4
    }))
  
    it("Before", () => expect($range(
      {"minimum": 2, "maximum": 4}, 1 as number
    )).toStrictEqual({
      "minimum": 1,
      "maximum": 4
    }))
  
    it("After", () => expect($range(
      {"minimum": 2, "maximum": 4}, 5 as number
    )).toStrictEqual({
      "minimum": 2,
      "maximum": 5
    }))
  
    it("Intersection", () => expect($range(
      {"minimum": 2, "maximum": 4},
      {"minimum": 3, "maximum": 5}
    )).toStrictEqual({
      "minimum": 2,
      "maximum": 5
    }))
  
    it("Same", () => expect($range(
      {"minimum": 2, "maximum": 2},
      {"minimum": 2, "maximum": 2}
    )).toBe(2))
  
    it("no first", () => expect($range(
      undefined, 2
    )).toBe(2))
  
    it("no second", () => expect($range(
      2, undefined
    )).toBe(2))
  })
  
  describe($addToSetLean.name, () => {
    it("Same", () => expect($addToSetLean(
      1, 1
    )).toBe(
      1
    ))
  
    it("New", () => expect($addToSetLean(
      undefined, 1
    )).toBe(
      1
    ))
  
    it("Nope", () => expect($addToSetLean(
      1, undefined
    )).toBe(1))
  
    it("Merge", () => expect($addToSetLean(
      1, 2
    )).toStrictEqual(
      new Set([1, 2])
    ))
  
    it("Conjunction", () => expect($addToSetLean(
      new Set([1, 2]), 3
    )).toStrictEqual(
      new Set([1, 2, 3])
    ))
  })
  
  describe($oneOrNull.name, () => {
    it("un + un", () => expect($oneOrNull(
      undefined, undefined
    )).toBe(
      undefined
    ))
  
    it("0 + un", () => expect($oneOrNull(
      0, undefined
    )).toBe(
      0
    ))
  
    it("un + 0", () => expect($oneOrNull(
      undefined, 0
    )).toBe(
      0
    ))
  
    it("0 + 0", () => expect($oneOrNull(
      0, 0
    )).toBe(
      0
    ))
  
    it("0 + 1", () => expect($oneOrNull(
      0, 1
    )).toBe(
      null
    ))
  })
  
  describe($first.name, () => {
    it("un + un", () => expect($first(
      undefined, undefined
    )).toBe(
      undefined
    ))
  
    it("nu + un", () => expect($first(
      null, undefined
    )).toBe(
      null
    ))
  
    it("un + nu", () => expect($first(
      undefined, null
    )).toBe(
      null
    ))
  
    it("null + false", () => expect($first(
      null, false
    )).toBe(
      null
    ))
  
    it("false + null", () => expect($first(
      false, null
    )).toBe(
      false
    ))
  })
  
  describe($last.name, () => {
    it("1 + 2", () => expect($last(
      1, 2
    )).toBe(2))

    it("1 + undefined", () => expect($last(
      1, undefined
    )).toBe(1))
  })

  describe($min.name, () => {
    it("undefined > 2", () => expect($min(
      undefined, 2
    )).toBe(2))

    it("2 < undefined", () => expect($min(
      2, undefined
    )).toBe(2))

    it("2 < 10", () => expect($min<string|number>(
      "2", 10
    )).toBe("2"))

    it("10 > 2", () => expect($min<string|number>(
      10, "2"
    )).toBe("2"))
  })

  describe($max.name, () => {
    it("undefined < -2", () => expect($max(
      undefined, -2
    )).toBe(-2))

    it("-2 > undefined", () => expect($max(
      2, undefined
    )).toBe(2))

    it("2 < 10", () => expect($max<string|number>(
      2, "10"
    )).toBe("10"))

    it("10 > 2", () => expect($max<string|number>(
     "10", 2
    )).toBe("10"))
  })

  describe($concatArrays.name, () => {
    it("empty", () => expect($concatArrays(
    )).toStrictEqual(
      undefined
    ))

    it("undefined + undefined", () => expect($concatArrays(
      undefined,
      undefined
    )).toStrictEqual(
      undefined
    ))

    it("[] + undefined", () => expect($concatArrays(
      [],
      [undefined]
    )).toStrictEqual(
      undefined
    ))

    it("undefined + undefined", () => expect($concatArrays(
      [undefined],
      [undefined]
    )).toStrictEqual(
      undefined
    ))

    it("single", () => expect($concatArrays(
      ["a"],
    )).toStrictEqual([
      "a"
    ]))

    it("a+a+a", () => expect($concatArrays<string|string[]>(
      "a",
      ["a"],
      "a"
    )).toStrictEqual([
      "a", "a", "a"
    ]))
  })

  describe("arithmetical", () => {
    it($add.name, () => expect(
      $add
    ).toStrictEqual(
      $sum
    ))

    describe($divide.name, () => {
      it("2/2", () => expect($divide(
        2, 2
      )).toBe(1))

      it("undefined/2", () => expect($divide(
        undefined, 2
      )).toBe(undefined))
  
      it("2/undefined", () => expect($divide(
        2, undefined
      )).toBe(undefined))

    })

    it($sum.name, () => expect($sum(
      undefined, 2, undefined, 5
    )).toBe(7))

    it($multiply.name, () => expect($multiply(
      undefined, 2, undefined, 5
    )).toBe(10))

    describe($avg.name, () => {
      //@ts-expect-error
      it("0", () => expect($avg()).toBe(undefined))

      //@ts-expect-error
      it("[]", () => expect($avg([])).toStrictEqual([]))

      it("number", () => expect(+$avg(1, 2, 3)).toBe(2))

      it("different #1", () => expect(+$avg(
        $avg(1, 2, 3),
        $avg(4, 5, 6),
        //@ts-expect-error
        {"toString": () => 7},
        {"valueOf": () => 8},
        null,
        false,
        undefined,
      )).toBe((1 + 8) / 2))

      it("different #2", () => expect(+$avg(
        undefined,
        $avg(1, 2, 3),
        $avg(4, 5, 6),
        //@ts-expect-error
        {"toString": () => 7},
        {"valueOf": () => 8},
        null,
        false,
        undefined,
      )).toBe((1 + 8) / 2))

      it("toFixed", () => expect($avg(1, 2).toFixed(2)).toBe("1.50"))
    })
  })
})

describe("logical", () => {
  describe($allOf.name, () => {
    it("no values", () => expect(
      //@ts-expect-error
      $allOf()
    ).toBe(true))

    it("undefined", () => expect($allOf(
      undefined
    )).toBe(true))

    it("true&false", () => expect($allOf(
      true, undefined, false
    )).toBe(false))

    it("true&true", () => expect($allOf(
      true, undefined, true
    )).toBe(true))
  })


  describe($anyOf.name, () => {
    it("no values", () => expect(
      //@ts-expect-error
      $anyOf()
    ).toBe(true))

    it("undefined", () => expect($anyOf(
      undefined
    )).toBe(true))

    it("true&false", () => expect($anyOf(
      true, undefined, false
    )).toBe(true))

    it("false&false", () => expect($anyOf(
      false, undefined, false
    )).toBe(false))  
  })

  describe($oneOf.name, () => {
    it("no values", () => expect(
      //@ts-expect-error
      $oneOf()
    ).toBe(false))

    it("undefined", () => expect($oneOf(
      undefined
    )).toBe(false))

    it("true&false", () => expect($oneOf(
      true, undefined, false
    )).toBe(true))

    it("false&false", () => expect($oneOf(
      false, undefined, false
    )).toBe(false))  

    it("true&true", () => expect($oneOf(
      true, undefined, true
    )).toBe(false))  
  })
})

describe("conditions", () => {
  describe($eq.name, () => {
    it("Date != Date", () => expect($eq(
      new Date("2023"),
      new Date("2023")
    )).toBe(false))
  
    it("Date==string", () => expect($eq<Date|string>(
      new Date("2023"),
      `${new Date("2023")}`
    )).toBe(true))

    it("[]!=a", () => expect($eq(
      [],
      "a"
    )).toBe(false))

    it("[a,b]==a", () => expect($eq(
      ["a", "b"],
      "a"
    )).toBe(true))
  })

  describe($ne.name, () => {
    it("Date != Date", () => expect($ne(
      new Date("2023"),
      new Date("2023")
    )).toBe(true))
  
    it("Date==string", () => expect($ne<Date|string>(
      new Date("2023"),
      `${new Date("2023")}`
    )).toBe(false))
  })

  describe($gt.name, () => {
    it("string > number", () => expect($gt<string|number>(
      "10", 9
    )).toBe(true))

    it("string > string", () => expect($gt<string|number>(
      "10", "9"
    )).toBe(false))

    it($gte.name, () => expect($gte<string|number>(
      "10", 10
    )).toBe(true))
  
    it($lt.name, () => expect($lt<string|number>(
      "10", 10
    )).toBe(false))
  
    it($lte.name, () => expect($lte<string|number>(
      "10", 10
    )).toBe(true))
  })

  describe($in.name, () => {
    it("undefined", () => expect($in(
      undefined,
      [undefined]
    )).toBe(true))

    it("undefined !@ []", () => expect($in(
      undefined,
      []
    )).toBe(false))

    it("[] !@ [a, c]", () => expect($in(
      [],
      ["a", "c"]
    )).toBe(false))

    it("[a,b] @ [a, c]", () => expect($in(
      ["a", "b"],
      ["a", "c"]
    )).toBe(true))
  })

  describe($nin.name, () => {
    it("undefined", () => expect($nin(
      undefined,
      [undefined]
    )).toBe(false))

    it("undefined @ []", () => expect($nin(
      undefined,
      []
    )).toBe(true))
  })
})

describe(newAvg.name, () => {
  it("empty", () => expect(newAvg().add([])).toBe(undefined))

  it("demo", () => {
    const avg = newAvg()

    avg.add([1])
    avg.add([2, 3])

    expect({
      "value": +avg,
      "string": `${avg}`,
      "json": JSON.stringify(avg),
      "bson": serialize({avg})
    }).toStrictEqual({
      "value": 2,
      "string": "2",
      "json": "2",
      "bson": serialize({"avg": 2}),
    })
  })

  it("multiple", () => {
    const avg1 = newAvg()
    , avg2 = newAvg()
    , avg3 = newAvg()

    avg1.add([1, 2])
    avg2.add([3, 4])
    avg3.add([avg1, avg2])

    expect(+avg3).toBe(2.5)
  })
})
