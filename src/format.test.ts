import { toArray } from "./async";
import { getAllPaths, json2csvIter, json2values } from "./format";

describe(json2csvIter.name, () => {
  it("order", async () => {
    const content: string[] = []

    for await (const line of json2csvIter([
      {"a": 0},
      {"b": undefined},
      {"b": null, "a": false}
    ])) {
      content.push(line)
    }

    expect({content}).toStrictEqual({
      "content": [
        "0",
        ",",
        "false,null"
      ]
    })
  })

  it("multi-type", async () => {
    const headers: string[] = []
    , content: string[] = []

    for await (const line of json2csvIter([
      {"a": {"b": 1}},
      {"a": 2},
      {"a": [2,3]},
    ], {headers})) {
      content.push(line)
    }

    expect({headers, content}).toStrictEqual({
      "headers": ["a.b", "a"],
      "content": [
        "1",
        ",2",
        ",[2,3]",
      ]
    })
  })

  it("predefined headers", async () => {
    const headers: string[] = ["a.0"]
    , content: string[] = []

    for await (const line of json2csvIter([
      {"a": [1, 100]},
      {"a": [2, 100]},
      {"a": [3, 100]},
    ], {headers})) {
      content.push(line)
    }

    expect({headers, content}).toStrictEqual({
      "headers": ["a.0"],
      "content": [
        "1",
        "2",
        "3",
      ]
    })
  })

  it("custom stringify", async () => {
    const headers: string[] = ["address", "depth", "obj"]
    , content: string[] = []

    for await (const line of json2csvIter([
      {"address": ["a", "b"], "depth": 1},
      {"address": "c", "depth": {"min": 1, "max": 2}},
      {"address": "d", "obj": {}}
    ], {headers, delimiter: " | ", "onObject": (v, paths) => {
      
      paths
      return Array.isArray(v) ? v.join(",")
      : paths.at(-1) === "depth" ? `${v.min}-${v.max}`
      : v
    }})) {
      content.push(line)
    }

    expect({headers, content}).toStrictEqual({
      "headers": ["address", "depth", "obj"],
      "content": [
        "a,b | 1 | ",
        "c | 1-2 | ",
        "d |  | [object Object]",
      ]
    })
  })
})

describe(json2values.name, () => {
  it("demo", () => expect(json2values({
    "a": 1
  })).toStrictEqual([
    "1"
  ]))
})

describe(getAllPaths.name, () => {
  it("demo", async () => expect(await toArray(getAllPaths({
    "primitive": true,
    "undefined": undefined,
    "array": [1, 2, 3],
    "nested": {
      "primitive": true,
      "undefined": undefined,
      "array": [1, 2, 3],
      "nested": {"done": () => {}}  
    }
  }, "", "/"))).toStrictEqual([
    "primitive",
    "undefined",
    "array",
    "nested.primitive",
    "nested.undefined",
    "nested.array",
    "nested.nested.done"
  ]))
})
