import { AssertionError } from "assert";
import type {
  Collection,
  Db
} from "mongodb";
import { MongoClient } from "mongodb";
import { fill } from "./array";
import { dbUrl } from "./config";
import { timer } from "./durate";
import { expectInRange } from "./jest";
import { reparse } from "./json";
import { bulkWriteOpts, insertMany, updateMany } from "./mongo-ops";
import {
  cursorInvalid,
  equalSchemas,
  json2mongoSchema,
  setSchema
} from "./mongo-schema";
import type { Dict } from "./ts-utils.types";

const collectionName ="jsonSchema"

let mongo: MongoClient
, db: Db

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()
  db = mongo.db()
})
afterAll(async () => await mongo.close())

describe("Schema actions", () => {
  let collection: Collection

  describe(setSchema.name, () => {
    beforeEach(async () => collection = await recreateCollection())

    it("delete", async () => expect(
      await setSchema(collection, null)
    ).toStrictEqual({"ok": 1}))

    it("set", async () => expect(
      await setSchema(collection, {"type": "object"})
    ).toStrictEqual({"ok": 1}))

    it("set same", async () => {
      await setSchema(collection, {"type": "object"})

      expect(
        await setSchema(collection, {"type": "object"})
      ).toStrictEqual({"ok": 1})
    })

    it("keep", async () => {
      await setSchema(collection, {"type": "object"})

      expect(
        await setSchema(collection, undefined)
      ).toBe(undefined)
    })

    it("change opts", async () => expect(
      await setSchema(collection, undefined, {
        "validationAction": "warn",
        "validationLevel": "off"
      })
    ).toStrictEqual({"ok": 1}))
  })

  describe(equalSchemas.name, () => {
    beforeAll(async () => collection = await recreateCollection())

    it("No schema @ mongo #1", async () => expect(
      await equalSchemas(collection, undefined!)
    ).toBe(null))

    it("No schema @ mongo #2", async () => expect(
      await equalSchemas(collection, {})
    ).toBe(null))

    it("There is schema @ mongo", async () => {
      await setSchema(collection, {"type": "object"})

      expect(
        await equalSchemas(collection, undefined!)
      ).toBe(undefined)
    })

    it("Compare to same", async () => {
      await setSchema(collection, {"type": "object"})

      expect(
        await equalSchemas(collection, {"type": "object"})
      ).toBe(true)
    })

    it("Compare to another", async () => {
      await setSchema(collection, {"type": "object"})

      expect(
        await equalSchemas(collection, {"type": "object", "properties": {}})
      ).toBeInstanceOf(AssertionError)
    })
  })

  describe("With additional validator", () => {
    const queryValidator = {
      "_id": {"$type": "objectId"},
      // From https://www.mongodb.com/docs/compass/current/validation/#validation-using-query-operators
      "$or": [
        { "phone": { "$type": "string" } },
      ]
    }
    , jsonSchema = {
      "type": "object",
      "required": ["_id"]
    } as const

    beforeAll(async () => collection = await recreateCollection())
    beforeAll(async () => db.command({
      "collMod": collectionName,
      "validator": queryValidator
    }))

    it("0. Current", async () => expect(
      await collection.options()
    ).toStrictEqual({
      "validationAction": "error",
      "validationLevel": "strict",
      "validator": queryValidator,
    }))

    it("1. Change options", async () => expect({
      "set": await setSchema(collection, undefined, {
        "validationAction": "warn",
        "validationLevel": "moderate"
      }),
      "options": await collection.options()
    }).toStrictEqual({
      "set": {"ok": 1},
      "options": {
        "validator": queryValidator,
        "validationAction": "warn",
        "validationLevel": "moderate",
      }
    }))

    it("2. Revert to default options", async () => expect({
      "set": await setSchema(collection, undefined, {
        "validationAction": "error",
        "validationLevel": "strict"
      }),
      "options": await collection.options()
    }).toStrictEqual({
      "set": {"ok": 1},
      "options": {
        "validator": queryValidator,
        "validationAction": "error",
        "validationLevel": "strict",
      }
    }))

    it("3. Add some schema", async () => expect({
      "set": await setSchema(collection, jsonSchema),
      "equal": await equalSchemas(collection, jsonSchema),
      "options": await collection.options()
    }).toStrictEqual({
      "set": {"ok": 1},
      "equal": true,
      "options": {
        "validator": {
          ...queryValidator,
          "$jsonSchema": jsonSchema
        },
        "validationAction": "error",
        "validationLevel": "strict",
      }
    }))

    it("4. Delete schema", async () => expect({
      "set": await setSchema(collection, null),
      "equal": await equalSchemas(collection, undefined!),
      "options": await collection.options(),
    }).toStrictEqual({
      "set": {"ok": 1},
      "equal": null,
      "options": {
        "validator": queryValidator,
        "validationAction": "error",
        "validationLevel": "strict",
      }
    }))
  })
})

describe("validationLevel demo", () => {
  type Item = {
    "int": number
    "genesis": string
  }
  const jsonSchema = {
    "type": "object",
    "properties": {
      "int": {"type": "integer"}
    }
  } as const

  let collection: Collection<Item>
  beforeAll(async () => collection = await recreateCollection())

  describe("moderate", () => {
    beforeAll(async () => {
      collection = await recreateCollection()

      await collection.insertMany([
        {"int": 0, "genesis": "before"},
        {"int": 0.25, "genesis": "before"},
        {"int": 0.5, "genesis": "before"}
      ])

      await setSchema(collection, jsonSchema, {
        "validationLevel": "moderate"
      })
    })

    it("1. insertMany ordered inserts until first fail", async () => {
      await expect(
        collection.insertMany([
          {"int": 1, "genesis": "insert-ordered"},
          {"int": 1.5, "genesis": "insert-ordered"},
          {"int": 2, "genesis": "insert-ordered"}
        ], {...bulkWriteOpts, "ordered": true})
      ).rejects.toThrow()

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "before"},
        {"int": 0.25, "genesis": "before"},
        {"int": 0.5, "genesis": "before"},
        {"int": 1, "genesis": "insert-ordered"},
      ])
    })

    it("2. insertMany unordered inserts all valid", async () => {
      await expect(
        collection.insertMany([
          {"int": 2, "genesis": "insert-unordered"},
          {"int": 2.5, "genesis": "insert-unordered"},
          {"int": 3, "genesis": "insert-unordered"}
        ], bulkWriteOpts)
      ).rejects.toThrow()

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "before"},
        {"int": 0.25, "genesis": "before"},
        {"int": 0.5, "genesis": "before"},
        {"int": 1, "genesis": "insert-ordered"},
        {"int": 2, "genesis": "insert-unordered"},
        {"int": 3, "genesis": "insert-unordered"}
      ])
    })

    it("3. updateMany sees all", async () => {
      expect(await collection.updateMany({}, {
        "$set": {
          "genesis": "update"
        }
      }, bulkWriteOpts)).toStrictEqual({
        "acknowledged": true,
        "matchedCount": 6,
        "modifiedCount": 6,
        "upsertedCount": 0,
        "upsertedId": null
      })

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "update"},
        {"int": 0.25, "genesis": "update"},
        {"int": 0.5, "genesis": "update"},
        {"int": 1, "genesis": "update"},
        {"int": 2, "genesis": "update"},
        {"int": 3, "genesis": "update"}
      ])
    })

    it("4. updateMany as partial fix", async () => {
      expect(await collection.updateMany({}, {
        "$set": {
          "genesis": "update-part-fix",
        },
        "$mul": {"int": 2}
      }, bulkWriteOpts)).toStrictEqual({
        "acknowledged": true,
        "matchedCount": 6,
        "modifiedCount": 6,
        "upsertedCount": 0,
        "upsertedId": null
      })

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "update-part-fix"},
        {"int": 0.5, "genesis": "update-part-fix"},
        {"int": 1, "genesis": "update-part-fix"},
        {"int": 2, "genesis": "update-part-fix"},
        {"int": 4, "genesis": "update-part-fix"},
        {"int": 6, "genesis": "update-part-fix"}
      ])
    })

    it("5. updateMany as break", async () => {
      await expect(collection.updateMany({}, {
        "$set": {
          "genesis": "update-break",
        },
        "$mul": {"int": 0.5}
      }, bulkWriteOpts)).rejects.toThrow()

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "update-break"},
        {"int": 0.25, "genesis": "update-break"},
        {"int": 1, "genesis": "update-part-fix"},
        {"int": 2, "genesis": "update-part-fix"},
        {"int": 4, "genesis": "update-part-fix"},
        {"int": 6, "genesis": "update-part-fix"}
      ])
    })


    it("6. updateMany as fix", async () => {
      expect(await collection.updateMany({}, {
        "$set": {
          "genesis": "update-fix",
        },
        "$mul": {"int": 4}
      }, bulkWriteOpts)).toStrictEqual({
        "acknowledged": true,
        "matchedCount": 6,
        "modifiedCount": 6,
        "upsertedCount": 0,
        "upsertedId": null
      })

      expect(await getAll()).toStrictEqual([
        {"int": 0, "genesis": "update-fix"},
        {"int": 1, "genesis": "update-fix"},
        {"int": 4, "genesis": "update-fix"},
        {"int": 8, "genesis": "update-fix"},
        {"int": 16, "genesis": "update-fix"},
        {"int": 24, "genesis": "update-fix"}
      ])
    })
  })

  describe("strict", () => {
    beforeAll(async () => {
      collection = await recreateCollection()

      await collection.insertMany([
        {"int": 0, "genesis": "before"},
        {"int": 0.25, "genesis": "before"},
        {"int": 0.5, "genesis": "before"}
      ])

      await setSchema(collection, jsonSchema, {
        "validationLevel": "strict"
      })
    })

    it("1. insertMany ordered inserts until first fail", async () => {
      const error =  await insertMany(collection, [
        {"int": 1, "genesis": "insert-ordered"},
        {"int": 1.5, "genesis": "insert-ordered"},
        {"int": 2, "genesis": "insert-ordered"}
      ], {"ordered": true})
      .catch(e => e)
      , items = await getAll()

      expect({
        "error": reparse(error),
        items
      }).toEqual({
        "error": {
          "code": 121,
          "collection": collectionName,
          "stack": expect.stringMatching(/MongoBulkWriteError.*\n.*at insertMany/),
          "errmsg": "Document failed validation",
          "failingDocumentId": expect.any(String),
          "op": {"int": 1.5, "genesis": "insert-ordered"},
          "operatorName": "$jsonSchema",
          "schemaRulesNotSatisfied": [
            {
              "operatorName": "properties",
              "propertiesNotSatisfied": [{
                "propertyName": "int",
                "details": [{
                  "consideredValue": 1.5,
                  "operatorName": "multipleOf",
                  "reason": "considered value is not a multiple of the specified value",
                  "specifiedAs": { "multipleOf": 1 },
                }],
              }]
            }
          ],
          "result": expect.anything(),
          "writeErrors": [expect.anything()],
        },
        "items": [
          {"int": 0, "genesis": "before"},
          {"int": 0.25, "genesis": "before"},
          {"int": 0.5, "genesis": "before"},
          {"int": 1, "genesis": "insert-ordered"},
        ]
      })
    })

    it("2. insertMany unordered inserts all valid", async () => {
      const error = await insertMany(collection, [
        {"int": 2, "genesis": "insert-unordered"},
        {"int": 2.5, "genesis": "insert-unordered"},
        {"int": 3, "genesis": "insert-unordered"}
      ])
      .catch(e => e)
      , items = await getAll()

      expect({
        "error": reparse(error),
        items
      }).toEqual({
        "error": expect.objectContaining({
          "op": {"int": 2.5, "genesis": "insert-unordered"},
          "schemaRulesNotSatisfied": [{
            "operatorName": "properties",
            "propertiesNotSatisfied": [{
              "details": [{
                "consideredValue": 2.5,
                "operatorName": "multipleOf",
                "reason": "considered value is not a multiple of the specified value",
                "specifiedAs": {
                  "multipleOf": 1,
                },
              }],
              "propertyName": "int",
            }],
          }],
        }),
        "items": [
          {"int": 0, "genesis": "before"},
          {"int": 0.25, "genesis": "before"},
          {"int": 0.5, "genesis": "before"},
          {"int": 1, "genesis": "insert-ordered"},
          {"int": 2, "genesis": "insert-unordered"},
          {"int": 3, "genesis": "insert-unordered"}
        ]
      })
    })

    it("3. updateMany fails on first invalid", async () => {
      const error = await updateMany(collection, {}, {
        "$set": {
          "genesis": "update"
        }
      }).catch(e => e)
      , items = await getAll()

      expect({
        "error": reparse(error),
        items
      }).toStrictEqual({
        "error": expect.objectContaining({
          "stack": expect.stringMatching(/MongoBulkWriteError.*\n.*at updateMany/),
          "errmsg": "Document failed validation",
          "collection": collectionName,
          "failingDocumentId": expect.any(String),
          "operatorName": "$jsonSchema",
          "schemaRulesNotSatisfied": [{
            "operatorName": "properties",
            "propertiesNotSatisfied": [{
              "propertyName": "int",
              "details": [{
                "consideredValue": 0.25,
                "operatorName": "multipleOf",
                "reason": "considered value is not a multiple of the specified value",
                "specifiedAs": {"multipleOf": 1,},
              }],
            }],
          }],
        }),
        "items": [
          {"int": 0, "genesis": "update"},
          {"int": 0.25, "genesis": "before"},
          {"int": 0.5, "genesis": "before"},
          {"int": 1, "genesis": "insert-ordered"},
          {"int": 2, "genesis": "insert-unordered"},
          {"int": 3, "genesis": "insert-unordered"}
        ]
      })
    })

    it("4. updateMany as partial fix fails on first invalid", async () => {
      const error = await updateMany(collection, {}, {
        "$set": {
          "genesis": "update-part-fix",
        },
        "$mul": {"int": 2}
      })
      .catch(e => e)
      , items = await getAll()

      expect({
        error: reparse(error),
        items
      }).toEqual({
        "error": expect.objectContaining({
          "schemaRulesNotSatisfied": [{
            "operatorName": "properties",
            "propertiesNotSatisfied": [{
              "propertyName": "int",
              "details": [{
                "consideredValue": 0.5,
                "operatorName": "multipleOf",
                "reason": "considered value is not a multiple of the specified value",
                "specifiedAs": {"multipleOf": 1}
              }]
            }]
          }]
        }),
        "items": [
          {"int": 0, "genesis": "update-part-fix"},
          {"int": 0.25, "genesis": "before"},
          {"int": 0.5, "genesis": "before"},
          {"int": 1, "genesis": "insert-ordered"},
          {"int": 2, "genesis": "insert-unordered"},
          {"int": 3, "genesis": "insert-unordered"}
        ]
      })
    })

    it("5. updateMany as fix", async () => {
      const result = await updateMany(collection, {}, {
        "$set": {
          "genesis": "update-fix",
        },
        "$mul": {"int": 4}
      })
      , items = await getAll()

      expect({
        result,
        items
      }).toStrictEqual({
        "result": {
          "acknowledged": true,
          "matchedCount": 6,
          "modifiedCount": 6,
          "upsertedCount": 0,
          "upsertedId": null,
        },
        "items": [
          {"int": 0, "genesis": "update-fix"},
          {"int": 1, "genesis": "update-fix"},
          {"int": 2, "genesis": "update-fix"},
          {"int": 4, "genesis": "update-fix"},
          {"int": 8, "genesis": "update-fix"},
          {"int": 12, "genesis": "update-fix"}
        ]
      })
    })
  })

  function getAll() {
    return collection.find().project({"_id": 0}).toArray()
  }
})


describe("Json Schema investigation", () => {
  type Item = {
    "random": number
  }

  const jsonSchema = {
    "type": "object",
    "required": ["random", "_id"],
    "additionalProperties": false,
    "properties": {
      "_id": {
        "type": ["string", "object"],
        "bsonType": "objectId"
      },
      "random": {
        "type": "number" // double
      }
    }
  } as const
  , bsonSchema = json2mongoSchema(jsonSchema)
    // 10 ** 5 : 1.5 sec
    // 5 * 10 ** 5 - 6 sec
    // 10 ** 6 : 12 sec

  , validCount = 3 * 10 ** 5
  , invalidCount = 1000
  , durations = {
    "insert": 0,
    "update": 0
  }

  let collection: Collection<Item>
  beforeAll(async () => collection = await recreateCollection())

  it.todo("Wide schema")
  it.todo("Additional data")

  describe("0. Valid without validation", () => {
    it("insert", async () => {
      const end = timer()
      , {insertedCount} = await collection.insertMany(fill(validCount, () => ({"random": Math.random()})))
      , duration = end()

      durations.insert = duration

      expect(insertedCount).toBe(validCount)
    })

    it("update", async () => {
      const end = timer()
      , {modifiedCount} = await collection.updateMany({}, {
        "$inc": {"random": 1}
      })
      , duration = end()

      durations.update = duration

      expect(modifiedCount).toBe(validCount)
    })
  })

  ;["1. Only valid", "2. With invalid"].forEach((title, i) => {
    describe(title, () => {
      const currentInvalidCount = i * invalidCount

      beforeAll(async () => {
        currentInvalidCount && await collection.insertMany(
          //@ts-expect-error
          fill(currentInvalidCount, () => ({"invalid": Math.random()}))
        )
      })

      it("filter", async () => expect(
        await collection.find({"$nor": [{
          "random": {"$type": "double"}
        }]}).toArray()
      ).toHaveLength(currentInvalidCount))

      /**https://www.mongodb.com/docs/manual/core/schema-validation/use-json-schema-query-conditions/#find-documents-that-don-t-match-the-schema */
      it("$nor schema", async () => expect(
        await collection.find({"$nor": [{"$jsonSchema": bsonSchema}]}).toArray()
      ).toHaveLength(currentInvalidCount))

      it("schema not", async () => expect(
        await collection.find({"$jsonSchema": {"not": bsonSchema}}).toArray()
      ).toHaveLength(currentInvalidCount))

      it(cursorInvalid.name, async () => expect(
        await (await cursorInvalid(collection, jsonSchema))!.toArray()
      ).toHaveLength(currentInvalidCount))
    })
  })

  describe("3. Update with strict validator", () => {
    it(setSchema.name, async () => expect(
      await setSchema(collection, jsonSchema, {
        "validationAction": "error",
        "validationLevel": "strict", // strict afterwards
      })
    ).toStrictEqual({"ok": 1}))

    it(cursorInvalid.name, async () => expect(
      await (await cursorInvalid(collection))!.count()
    ).toBe(invalidCount))
  })

  describe("4. Manipulations with invalid", () => {
    it("insertOne invalid", () => expect(
      //@ts-expect-error
      collection.insertOne({"invalid": true})
    ).rejects.toThrow("Document failed validation"))

    it("insertMany invalid", () => expect(
      //@ts-expect-error
      collection.insertMany([{"invalid": true}, {"invalid": 1}])
    ).rejects.toThrow("Document failed validation"))

    it("insertMany mix", async () => {
      const before = await collection.find().count()

      await expect(
        //@ts-expect-error
        collection.insertMany([{"invalid": true}, {"random": 1}])
      ).rejects.toThrow("Document failed validation")

      const after = await collection.find().count()

      expect({before, after}).toStrictEqual({
        "before": validCount + invalidCount,
        "after": before
      })
    })

    it("1. insertMany mix unordered", async () => {
      const before = await collection.find().count()

      await expect(
        //@ts-expect-error
        collection.insertMany([{"invalid": true}, {"random": 1}], {
          "ordered": false
        })
      ).rejects.toThrow("Document failed validation")

      const after = await collection.find().count()

      expect({before, after}).toStrictEqual({
        "before": validCount + invalidCount,
        "after": before + 1
      })
    })


    it("2. insertMany mix bypass", async () => {
      const before = await collection.find().count()
      , {insertedCount} = await collection.insertMany(
        [{"invalid": true} as unknown as Item, {"random": 1}],
        {
          "bypassDocumentValidation": true
        }
      )
      , after = await collection.find().count()

      expect({before, insertedCount, after}).toStrictEqual({
        "before": 1 + validCount + invalidCount,
        "insertedCount": 2,
        "after": before + insertedCount
      })
    })

    it("updateOne", () => expect(collection.updateOne({"random": 1}, {
      //@ts-ignore
      "$set": {"invalid": 1},
      "$unset": {"random": 1},
    })).rejects.toThrow("Document failed validation"))

    it("updateMany", () => expect(collection.updateMany({"random": 1}, {
      //@ts-ignore
      "$set": {"invalid": 1},
      "$unset": {"random": 1},
    })).rejects.toThrow("Document failed validation"))

  })

  describe("5. Compare manipulations", () => {
    beforeAll(() => collection.deleteMany({}))

    it("insert", async () => {
      const end = timer()
      , {insertedCount} = await collection.insertMany(fill(validCount, () => ({"random": Math.random()})))
      , duration = end()

      expect(insertedCount).toBe(validCount)
      expectInRange(duration / durations.insert, {
        "minimum": 0.8,
        "maximum": 1.3
      })
    })

    it("update", async () => {
      const end = timer()
      , {modifiedCount} = await collection.updateMany({}, {
        "$inc": {"random": 1}
      })
      , duration = end()

      expect(modifiedCount).toBe(validCount)
      expectInRange(duration / durations.update, {
        "minimum": 0.7,
        "maximum": 1.3
      })
    })
  })
})

describe(json2mongoSchema.name, () => {
  describe("bad schema", () => {
    [null, true, []].forEach(badSchema => it(`${JSON.stringify(badSchema)}`, () => expect(
      () => json2mongoSchema(
        //@ts-expect-error
        badSchema
      )
    ).toThrow()))
    Object.entries({
      "null": null,
      "true": true,
      "array": []
    })
  })

  it("_id", () => expect(json2mongoSchema({
    "type": "object",
    "bsonType": "objectId"
  })).toStrictEqual({
    "bsonType": "objectId"
  }))

  it("integer", () => expect(json2mongoSchema({
    "type": "integer"
  })).toStrictEqual({
    "bsonType": ["int", "double"],
    "multipleOf": 1
  }))

  it("integer % 2", () => expect(json2mongoSchema({
    "type": "integer",
    "multipleOf": 2
  })).toStrictEqual({
    "bsonType": ["int", "double"],
    "multipleOf": 2
  }))

  it("long integer", () => expect(json2mongoSchema({
    "type": "integer",
    "bsonType": "long"
  })).toStrictEqual({
    "bsonType": "long"
  }))

  describe("exclusiveMinimum", () => {
    it("only inclusive", () => expect(json2mongoSchema({
      "minimum": 5
    })).toStrictEqual({
      "minimum": 5
    }))

    it("only exclusive", () => expect(json2mongoSchema({
      "exclusiveMinimum": 5
    })).toStrictEqual({
      "minimum": 5,
      "exclusiveMinimum": true
    }))

    it("keep exclusive", () => expect(json2mongoSchema({
      "minimum": 5,
      "exclusiveMinimum": 5
    })).toStrictEqual({
      "minimum": 5,
      "exclusiveMinimum": true
    }))

    it("obvious exclusive", () => expect(json2mongoSchema({
      "minimum": 4,
      "exclusiveMinimum": 5
    })).toStrictEqual({
      "minimum": 5,
      "exclusiveMinimum": true
    }))

    it("keep inclusive", () => expect(json2mongoSchema({
      "minimum": 6,
      "exclusiveMinimum": 5
    })).toStrictEqual({
      "minimum": 6
    }))
  })

  describe("exclusiveMaximum", () => {
    it("only inclusive", () => expect(json2mongoSchema({
      "maximum": 5
    })).toStrictEqual({
      "maximum": 5
    }))

    it("only exclusive", () => expect(json2mongoSchema({
      "exclusiveMaximum": 5
    })).toStrictEqual({
      "maximum": 5,
      "exclusiveMaximum": true
    }))

    it("keep exclusive", () => expect(json2mongoSchema({
      "maximum": 5,
      "exclusiveMaximum": 5
    })).toStrictEqual({
      "maximum": 5,
      "exclusiveMaximum": true
    }))

    it("obvious exclusive", () => expect(json2mongoSchema({
      "maximum": 6,
      "exclusiveMaximum": 5
    })).toStrictEqual({
      "maximum": 5,
      "exclusiveMaximum": true
    }))


    it("keep inclusive", () => expect(json2mongoSchema({
      "maximum": 4,
      "exclusiveMaximum": 5
    })).toStrictEqual({
      "maximum": 4
    }))
  })

  it("additional*", () => expect(json2mongoSchema({
    "type": ["object", "array"],
    "additionalProperties": false,
    "additionalItems": {
      "type": "integer"
    }
  })).toStrictEqual({
    "type": ["object", "array"],
    "additionalProperties": false,
    "additionalItems": {
      "bsonType": ["int", "double"],
      "multipleOf": 1
    }
  }))

  it("nested", () => expect(json2mongoSchema({
    "type": "object",
    "properties": {
      "tuple": {
        "type": "array",
        "items": [
          {"bsonType": "objectId"},
          {"type": "integer"}
        ]
      },
      "object": {
        "type": "object",
        //@ts-expect-error Is not assignable to type 'undefined'
        "propertyNames": {"const": "a"},
        "properties": {
          "a": {"type": "object"}
        }
      }
    },
    "whatever": {"hello": "world"},
    "whatever2": ["hello", "world"]
  })).toStrictEqual({
    "type": "object",
    "properties": {
      "tuple": {
        "type": "array",
        "items": [
          {"bsonType": "objectId"},
          {"bsonType": ["int", "double"], "multipleOf": 1}
        ]
      },
      "object": {
        "type": "object",
        "properties": {
          "a": {"type": "object"}
        }
      }
    }
  }))

  it("definitions", () => expect(json2mongoSchema({
    "type": "object",
    "definitions": {}
  })).toStrictEqual({
    "type": "object"
  }))

  it("double apply", () => expect(
    //@ts-ignore
    json2mongoSchema(json2mongoSchema({
      "type": "object",
      "properties": {
        "a": {"const": "a"},
        "excl": {
          "type": ["integer", "string"],
          "exclusiveMinimum": 2
        }
      }
    }))
  ).toStrictEqual(json2mongoSchema({
    "type": "object",
    "properties": {
      "a": {"const": "a"},
      "excl": {
        "type": ["integer", "string"],
        "exclusiveMinimum": 2
      }
    }
  })))
})

async function recreateCollection<T extends Dict>() {
  ;(await db.listCollections({"name": collectionName}).toArray())[0]
  && await db.dropCollection(collectionName)

  return await db.createCollection<T>(collectionName)
}
