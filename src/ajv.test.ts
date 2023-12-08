import { ObjectId } from "mongodb";
import { pushErrors, validate, validatorWithCoerceTypes } from "./ajv";
import { reparse } from "./json";
import type { Arg0, Schema2Ts } from "./ts-utils.types";

describe(validate.name, () => {
  describe("required and default", () => {
    it("with default", () => {
      const data = {}

      expect({
        "valid": validate({
          "type": "object",
          "required": ["r+d+", "r-d+"],
          "properties": {
            "r+d+": {"default": 1},
            "r-d+": {"default": 1}
          }
        }, data),
        data
      }).toStrictEqual({
        "valid": true,
        "data": {
          "r+d+": 1,
          "r-d+": 1
        }
      })
    })

    it("required without default", () => expect(() =>
      validate({
        "type": "object",
        "required": ["r+d-"],
      }, {}
    )).toThrow())
  })

  it("primitive + object", () => expect(validate(
    {
      "type": "array",
      "items": {
        "oneOf": [
          {"instanceof": "Date"},
          {"type": "number"}
        ]
      }
    },
    [new Date(), 123]
  )).toBe(true))
})

describe(pushErrors.name, () => {
  it("additionalProperties", () => {
    const errs: Arg0<typeof pushErrors> = {}

    try {
      validate(
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "a": {},
            "b": {}
          }
        },
        {
          "c": 1,
          "d": 1
        }
      )
    } catch (e: any) {
      pushErrors(errs, e.errors, "id")
    }

    expect(errs).toStrictEqual({
      "#/additionalProperties": {
        "must NOT have additional properties": {
          "values": new Set(["c", "d"]),
          "ids": new Set(["id"])
        }
      }
    })
  })

  it("type", () => {
    const errs: Arg0<typeof pushErrors> = {}
    , items = [
      {"str": {}},
      {"str": []},
      {"str": "1"},
      {"str": 1},
    ]

    for (let i = 0; i < items.length; i++)
      try {
        validate({
          "type": "object",
          "properties": {
            "str": {"type": "string"}
          }
        }, items[i]
        )
      } catch (e: any) {
        pushErrors(errs, e.errors, i)
      }

    expect(errs).toStrictEqual({
      "#/properties/str/type": {
        "must be string": {
          "ids": new Set([0, 1, 3]),
          "values": new Set([
            "[Object]",
            "[Array]",
            1
          ])
        }
      }
    })
  })

  it("sensitive", () => {
    const errs: Arg0<typeof pushErrors> = {}

    try {
      validate(
        {
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        [
          1,
          "abc@gmail.com",
          "xyz@yahoo.com",
          "@@@"
        ]
      )
    } catch (e: any) {
      pushErrors(errs, e.errors, "id", probe => typeof probe === "string" && /^[^@]+@[^@]+$/.test(probe))
    }

    expect(errs).toStrictEqual({
      "#/items/type": {
        "must be number": {
          "ids": new Set(["id"]),
          "values": new Set([
            "<hidden>",
            "@@@"
          ])
        }
      }
    })
  })
})

describe("$ts", () => {
  it("Unknown `$ts` value", () => expect(() =>
    validate({"$ts": "abc",}, "abc")
  ).toThrow("$ts: unknown"))

  it("No coercion - negative", () => expect(() =>
    validate({"$ts": "Date",}, "abc")
  ).toThrow('data must pass "$ts" keyword validation'))

  it("No coercion - positive", () => expect(
    validate({"$ts": "Date",}, new Date())
  ).toBe(true))

  it("With coercion - positive", () => expect(
    validate({"$ts": "Date",}, new Date(), undefined, validatorWithCoerceTypes)
  ).toBe(true))

  it("With coercion", () => {
    const schema = {
      "type": "object",
      "properties": {
        "date": {
          "type": ["object", "string"],
          "$ts": "Date",
        },
        "address": {"type": "string", "$ts": "AddressId"},
        "type": {
          "$ts": "ObjectId",
          "bsonType": "objectId"
        },
      }
    } as const
    , data: Schema2Ts<typeof schema, {
      "AddressId": string
      "ObjectId": ObjectId
      "Date": Date
    }> = {
      "date": new Date("2022-01-01"),
      "address": "abc",
      "type": ObjectId.createFromHexString("61dea4b08180f631f264e443")
    }
    , payload = reparse(data)
  
    validate(schema, payload, undefined, validatorWithCoerceTypes)

    expect(payload).toStrictEqual(data)
  })
})

describe("transform", () => {
  it("address demo", () => {
    const schema = {
      "type": "object",
      "properties": {
        "addresses": {
          "type": "array",
          "items": {
            "type": "string",
            "transform": ["toLowerCase"]
          },
        }
      }
    }

    const payload = {
      "addresses": ["ABC", "123", "0xcaD621da75a66c7A8f4FF86D30A2bF981Bfc8FdD"]
    }

    validate(schema, payload);
    expect(payload).toStrictEqual({
      "addresses": ["abc", "123", "0xcaD621da75a66c7A8f4FF86D30A2bF981Bfc8FdD".toLowerCase()]
    })
  })
})