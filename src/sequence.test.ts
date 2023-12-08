import { updateIndex } from "./sequence";

describe(updateIndex.name, () => {
  it("Same", () => expect(updateIndex(
    ["a", "b", "c"],
    ["a", "b", "c"]
  )).toStrictEqual(
    null
  ))

  it("Update", () => expect(updateIndex(
    ["a", "b", "c"],
    ["b", "c", "d"]
  )).toStrictEqual(
    2
  ))

  it("Already", () => expect(updateIndex(
    ["a", "b", "c"],
    ["b", "c"]
  )).toStrictEqual(
    null
  ))

  it("Conflict", () => expect(() => updateIndex(
    ["a", "b", "c"],
    ["b", "d"]
  )).toThrow("Conflict"))

  it("Unrelated", () => expect(() => updateIndex(
    ["a", "b", "c"],
    ["1", "2"]
  )).toThrow("Unrelated"))

  it("Unrelated2", () => expect(() => updateIndex(
    ["a", "b", "c"],
    ["1", "a"]
  )).toThrow())
})