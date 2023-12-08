import {
  append,
  deepClone,
  deepTraverse,
  definingProperties,
  entrize,
  forIn,
  isObject,
  lens,
  pick,
  project,
  projectionIncludes,
  transpose
} from "./object";
import type { Dict } from "./ts-utils.types";

describe(transpose.name, () => {
  it("demo", () => expect(transpose(
    {
      "a": {"v": 1},
      "b": {"v": 3}
    },
    ({v}) => `${2 * v}`
  )).toStrictEqual({
    "2": "a",
    "6": "b"
  }))
})

describe(forIn.name, () => {
  it("demo", () => expect(forIn(
    {
      "a": 0,
      "b": 1,
      "c": 2
    },
    v => v ? v + 1 : undefined
  )).toStrictEqual({
    "b": 2,
    "c": 3
  }))

  it("undefined", () => expect(forIn(
    undefined,
    () => {
      throw Error("Shouldn't be launched")
    }
  )).toStrictEqual({}))

  it("mutable", () => {
    const source = {"a": true, "b": false}
    , result = forIn(source, v => v || undefined,
      //@ts-expect-error
      source
    )

    expect(result).toStrictEqual({"a": true})
    expect(result).toBe(source)
  })
})

describe(lens.name, () => {
  it("Got", () => {
    const value = {"new": 1}
    , obj = {"a": value}

    expect(lens(
      obj,
      ["a"],
      value
    )).toStrictEqual(
      value
    )

    expect(obj).toStrictEqual({
      "a": value
    })
  })

  it("Assign", () => {
    const value = {"new": 1}
    , obj = {}

    expect(lens(
      obj,
      //@ts-expect-error
      ["a"],
      value
    )).toBe(
      value
    )

    expect(obj).toStrictEqual({
      "a": value
    })
  })

  it("Deep", () => {
    expect(lens(
      {"a": {"b": {"c": 1}}},
      ["a", "b"],
      undefined
    )).toStrictEqual({
      "c": 1
    })
  })

  it("Deep assign", () => {
    const assign = {"deep": true}
    , source = {"a": {"b": {"c": 1}}} as {"a": {"b": unknown, "c": {"d": typeof assign}}}
    , lensed = lens(
      source,
      //@ts-expect-error
      ["a", "c", "d"],
      assign
    )

    expect({lensed, source}).toStrictEqual({
      "lensed": assign,
      "source": {
        "a": {
          "b": {"c": 1},
          "c": {"d": assign}
        }
      }
    })
  })
})

describe(entrize.name, () => {
  it("array", () => expect(entrize({
    "r1": {
      "k1": {"b": 1, "c": {"d": 1}},
      "k2": {"b": 2, "c": {"d": 2}}
    },
    "r2": {
      "k1": {"b": 3, "c": {"d": 3}},
      "k2": {"b": 4, "c": {"d": 4}}
    }
  }, 2, false)).toStrictEqual([
    [
      {"b": 1, "c": {"d": 1}},
      {"b": 2, "c": {"d": 2}}
    ],
    [
      {"b": 3, "c": {"d": 3}},
      {"b": 4, "c": {"d": 4}}
    ]
  ]))

  it("kv", () => expect(entrize({
    "r1": {
      "k1": {"b": 1, "c": {"d": 1}},
      "k2": {"b": 2, "c": {"d": 2}}
    },
    "r2": {
      "k1": {"b": 3, "c": {"d": 3}},
      "k2": {"b": 4, "c": {"d": 4}}
    }
  }, 2, true)).toStrictEqual([{
    "k": "r1", "v": [
      {"k": "k1", "v": {"b": 1, "c": {"d": 1}}},
      {"k": "k2", "v": {"b": 2, "c": {"d": 2}}}
  ]}, {
    "k": "r2", "v": [
      {"k": "k1", "v": {"b": 3, "c": {"d": 3}}},
      {"k": "k2", "v": {"b": 4, "c": {"d": 4}}}
    ]},
  ]))
})

describe(project.name, () => {
  it("1 is pick mode", () => expect(project(
    {"a": "x", "b": "y"},
    {"a": 1}
  )).toStrictEqual(
    {"a": "x"}
  ))

  it("0 is omit mode", () => expect(project(
    {"a": "x", "b": "y"},
    {"a": 0}
  )).toStrictEqual(
    {"b": "y"}
  ))

  it("Empty object does nothing", () => expect(project(
    {"a": "x", "b": "y"},
    {}
  )).toStrictEqual(
    {"a": "x", "b": "y"},
  ))

  it("Function is mutable", () => {
    const source = {"a": "x", "b": "y"}

    expect(
      project(source, {"a": 1})
    ).toBe(source)
  })

  it("Mode is picked from the first key", () => expect(project(
    {"a": "x", "b": "y"},
    {"a": 1}
  )).toStrictEqual(
    {"a": "x"}
  ))

  it("undefined means do nothing", () => expect(project(
    {"a": "x", "b": "y"},
    undefined
  )).toStrictEqual(
    {"a": "x", "b": "y"}
  ))

  it("null means do nothing", () => expect(project(
    {"a": "x", "b": "y"},
    null
  )).toStrictEqual(
    {"a": "x", "b": "y"}
  ))

  it("prop as string", () => expect(project(
    {"a": "x", "b": "y"},
    {"a": 1, "Y": "b"}
  )).toStrictEqual({
    "a": "x",
    "Y": "y"
  }))
})

describe(pick.name, () => {
  it("demo", () => expect(pick(
    {
      "k1": "v1",
      "k2": "v2",
      "undefined": undefined
    } as {
      "k1": string
      "k2"?: string
      "undefined": undefined|string
      "absent"?: string
    },
    ["k1", "undefined", "absent"]
  )).toStrictEqual({
    "k1": "v1"
  }))
})

describe(append.name, () => {
  it("demo", () => expect(append(
    {"a": 1, "b": 1} as Dict<number>,
    {"a": 2, "c": 2},
  )).toStrictEqual({
    "a": 1, "b": 1, "c": 2
  }))
})

describe(projectionIncludes.name, () => {
  type Obj = Partial<{"a": string, "b": string}>

  it("no projection", () => expect(projectionIncludes(
    undefined,
    "b"
  )).toBe(true))


  it("b=1", () => expect(projectionIncludes(
    {"a": 1, "b": 1},
    "b"
  )).toBe(true))

  it("b=0", () => expect(projectionIncludes(
    {"a": 0, "b": 0},
    "b"
  )).toBe(false))


  it("b @ 0", () => expect(projectionIncludes<Obj>(
    {"a": 0},
    "b"
  )).toBe(true))

  it("b @ 1", () => expect(projectionIncludes<Obj>(
    {"a": 1},
    "b"
  )).toBe(false))
})

describe(isObject.name, () => {
  it("1. correct object", () => expect(isObject({a: 2})).toBe(true));
  it("2. not correct object", () => expect(isObject("")).toBe(false));
})

describe(deepTraverse.name, () => {
  it("1. update schema", () => {

    const schema = {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "$ts": "AddressId",
        }
      }
    }
    function cb(data: any) {
      if(isObject(data) && data.$ts === "AddressId") 
        (data.transform  && Array.isArray(data.transform)) ? 
        data.transform.push("toLowerCase") : data.transform = ["toLowerCase"];
      
    }
    deepTraverse(schema, cb);

    //@ts-ignore
    expect(schema.properties.address.transform.includes("toLowerCase")).toBe(true)
  });

  it("2. update schema with array", () => {

    const schema = {
      "type": "object",
      "properties": {
        "addresses": {
          "type": "array",
          "items": {
            "type": "string",
            "$ts": "AddressId"
          }
        }
      }
    }
    function cb(data: any) {
      if(isObject(data)) 
        if (data.type === "array" && data.items && data.items?.$ts === "AddressId")
        (data.transform  && Array.isArray(data.transform)) ? 
        data.transform.push("toLowerCase") : data.transform = ["toLowerCase"];

    }
    deepTraverse(schema, cb);

    //@ts-ignore
    expect(schema.properties.addresses.transform.includes("toLowerCase")).toBe(true)
  });
})

describe(deepClone.name, () => {
  it("keeps shape", () => {
    const source = {
      "a": {"b": 1},
      "c": [{"d": 2}],
      "d": new Set()
    }
    , clone = deepClone(source)

    expect(clone).toStrictEqual(clone)
  })

  it("clones object", () => {
    const source = {
      "a": {"b": 1},
    }
    , clone = deepClone(source)

    clone.a.b++

    expect(source).toStrictEqual({"a": {"b": 1}})
    expect(clone).toStrictEqual({"a": {"b": 2},})
  })

  it("doesn't clone not=object", () => {
    const source = {
      "a": {"b": [0, 1]},
    }
    , clone = deepClone(source)

    clone.a.b.push(2)
    //@ts-expect-error
    delete clone.a.b

    expect(source).toStrictEqual({"a": {"b": [0, 1, 2]}})
    expect(clone).toStrictEqual({"a": {}})
  })
})

describe(definingProperties.name, () => {
  it("demo", () => expect(Object.keys(definingProperties(
    {"a": 1, "b": 2} as Dict<number>,
    ["a", "c"],
    {"enumerable": false}
  ))).toStrictEqual(
    ["b"]
  ))
})
