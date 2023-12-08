import { reparse } from "./json";

describe(reparse.name, () => {
  const data = {
    "number": 0.1234567890123456789,
    "prim arr": [3, 2, 1],
    "obj arr": [{"b": 2}, {"b": 1}]
  }
  
  it("default reviver", () => expect(reparse(data)).toStrictEqual({
    "number": 0.123456789,
    "prim arr": [1, 2, 3],
    "obj arr": [{"b": 2}, {"b": 1}]
  }))

  it("nop reviver", () => expect(reparse(
    data, (_, v) => v
  )).toStrictEqual(
    data
  ))
})
