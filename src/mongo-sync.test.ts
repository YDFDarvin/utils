import type {
  Collection,
  Db
} from "mongodb"
import { MongoClient } from "mongodb"
import { sort } from "./array"
import { dbUrl } from "./config"
import { aggregateIndexes } from "./mongo-indexes"
import {
  recreateCollection,
  schemaCheck,
  sync4tests,
  syncCollectionIndexes
} from "./mongo-sync"
import { forIn, pick } from "./object"
import type {
  Arg0,
  Dict,
  Schema2Ts
} from "./ts-utils.types"

const collectionName ="mongo-check"

let mongo: MongoClient
, db: Db

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()
  db = mongo.db()
})
afterAll(async () => await mongo.close())

describe(schemaCheck.name, () => {
  type Item = Schema2Ts<typeof jsonSchema>

  const jsonSchema = {
    "type": "object",
    "required": ["int", "genesis"],
    "properties": {
      "int": {"type": "integer"},
      "genesis": {"type": "string"}
    }
  } as const

  let collection: Collection<Item>

  beforeAll(async () => { collection = await recreateCollection(db, collectionName) })

  it("1. Self Check on empty", async () => expect(
    await schemaCheck(collection)
  ).toStrictEqual({
    "ok": true,
    "equality": undefined,
    "totalCount": 0,
    "invalidCount": 0,
    "errors": {}
  }))

  it("2. insert bad Data", async () => {
    await collection.insertMany([
      {"int": 0, "genesis": "before"},
      {"int": 0, "genesis": "before"},
      {"int": 0.5, "genesis": "before"},
      {"int": 0.5, "genesis": "before"},
    ])
  })

  it("3. Check schema", async () => expect(
    await schemaCheck(collection, jsonSchema)
  ).toStrictEqual({
    "ok": false,
    "equality": null,
    "totalCount": 4,
    "invalidCount": 2,
    "errors": {
      "#/properties/int/type": {
        "must be integer": {
          "ids": expect.any(Set),
          "values": new Set([
            0.5
          ])
        }
      }
    }
  }))
})

describe(syncCollectionIndexes.name, () => {
  let collection: Collection

  beforeAll(async () => { collection = await recreateCollection(db, collectionName) })

  it("no indexes", async () => {
    const result = await syncCollectionIndexes(collection, {"indexes": undefined}, {})

    expect(result).toBe(undefined)
  })

  it("create experimental as hidden", async () => {
    const result = await syncCollectionIndexes(collection, {"indexes": {
      "_id_": {"key": {"_id": 1}},
      "exp": {
        "experimental": true,
        "key": {"a": 1}
      }
    }}, {
      "create": true,
      "indexParams": {"experimental": "hide"}
    })
    , actual = await aggregateIndexes4test(collection)

    expect({result, actual}).toEqual({
      "result": expect.objectContaining({
        "ok": 1,
        "created": ["exp"]
      }),
      "actual": [{
        "name": "_id_"
      }, {
        "name": "exp",
        "hidden": true
      }]
    })
  })

  it("not ok - duplicated description", async () => {
    const indexes = {
      "dupl1": {"key": {"dupl": 1}},
      "dupl2": {"key": {"dupl": 1}},
    }
    , result = await syncCollectionIndexes(collection, {indexes}, {"create": true})

    expect(result).toEqual(expect.objectContaining({
      "ok": false,
      "duplicates": [
        Object.entries(indexes)
        .map(([name, data]) => ({...data, name}))
      ]
    }))
  })

  describe("features", () => {
    beforeAll(async () => { collection = await recreateCollection(db, collectionName) })
    
    it("ordinary", async () => {
      await collection.dropIndexes()

      const start = {
        "_id_": {"key": {"_id": 1}},
        "same": {"key": {"same": 1}},
        "hidden": {"key": {"hidden": 1}, "hidden": true},
        "unhide": {"key": {"unhide": 1}, "hidden": true},
        "hide": {"key": {"hide": 1}},
        "rename1": {"key": {"rename": 1}},
        "change": {"key": {"change1": 1}},
        "delete": {"key": {"delete": 1}},
      }
      , end = {
        "_id_": {"key": {"_id": 1}},
        "new": {"key": {"new": 1}},
        "same": {"key": {"same": 1}},
        "hidden": {"key": {"hidden": 1}, "hidden": true},
        "unhide": {"key": {"unhide": 1}},
        "hide": {"key": {"hide": 1}, "hidden": true},
        "rename2": {"key": {"rename": 1}},
        "change": {"key": {"change2": 1}}
      }
      , $project = {"name": 1, "hidden": 1, "key": 1} as const

      await syncCollectionIndexes(collection, {"indexes": start}, {
        "create": true,
        "indexParams": {}
      })

      await syncCollectionIndexes(collection, {"indexes": end}, {
        "create": true,
        "delete": "hide",
        "indexParams": {"hide": true}
      })
      const createdOnly = await aggregateIndexes4test(collection, $project)
      await syncCollectionIndexes(collection, {"indexes": end}, {
        "create": true,
        "modify": true,
        "rename": true,
        "delete": "hide",
        "indexParams": {"hide": true}
      })
      const allModed = await aggregateIndexes4test(collection, $project)
      await syncCollectionIndexes(collection, {"indexes": end}, {
        "delete": true
      })
      const deletedOutdated = await aggregateIndexes4test(collection, $project)
      
      expect({createdOnly, allModed, deletedOutdated}).toStrictEqual(forIn(
        {
          "createdOnly": {
            ...start,
            ...pick(end, ["new"])
          },
          "allModed": {
            ...end,
            ...pick(start, ["delete"])
          },
          "deletedOutdated": end
        },
        
        v => sort(
          Object.entries(v)
          .map(([name, {hidden, ...data}]) => ({
            ...data,
            name,
            ...name === "delete" && {"hidden": true}
          })),
          {"name": 1}
        )
      ))
    })
  })


  function aggregateIndexes4test(collection: Arg0<typeof aggregateIndexes>, $project = {"name": 1, "hidden": 1} as Dict<0|1>) {
    return aggregateIndexes(collection,
      {"$sort": {"name": 1}},
      {$project}
    )
  }
})

describe(sync4tests.name, () => {
  let collection: Collection

  beforeAll(async () => { collection = await recreateCollection(db, collectionName) })

  it("demo", async () => {
    collection

    const r = await sync4tests(db, {
      "whatever": {
        "collection": collectionName,
        "jsonSchema": {"type": "object"},
        "indexes": {
          "_id_": {"key": {"_id": 1}}
        }
      }
    })

    expect(r.whatever.collectionName).toBe(collectionName)
  })
})