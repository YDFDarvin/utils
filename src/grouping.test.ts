import {
  condEntry,
  logicalOperate,
  matchConditions,
  valueAggregate,
  valueOperate,
  type ConditionEntry
} from "./grouping"

describe(valueAggregate.name, () => {
  it("number via args", () => expect(valueAggregate(
    "$sum",
    //@ts-expect-error
    1,
    2,
    3
  )).toBe(6))

  it("string via fn", () => expect(valueAggregate(
    "$sum"
  )(
    "1", "2", "3"
  )).toBe("123"))

})
describe(valueOperate.name, () => {
  it("args", () => expect(valueOperate(
    "$divide", [4, 2]
  )).toBe(2))
})

describe(logicalOperate.name, () => {
  it("args", () => expect(logicalOperate(
    "$anyOf", true, false, true
  )).toBe(true))

  it("fn", () => expect(logicalOperate(
    "$anyOf"
  )(
    true, false, true
  )).toBe(true))
})

describe(condEntry.name, () => {
  const condition: ConditionEntry[] = [
    {"op": "$gt", "value": 2},
    {"op": "$lt", "value": 4},
  ]

  it("true", () => expect(condEntry(
    "3", condition
  )).toBe(true))

  it("true", () => expect(condEntry(
    "1", condition
  )).toBe(false))
})

describe(matchConditions.name, () => {
  //@ts-ignore Somehow infinite
  it("empty match", () => expect(matchConditions(
    {},
    {}
  )).toBe(true))

  it("empty source", () => expect(matchConditions(
    {},
    {"a": {"$eq": 1}}
  )).toBe(false))

  it("true", () => expect(matchConditions(
    {"a": "1"},
    {"a": {"$eq": 1}}
  )).toBe(true))
})
