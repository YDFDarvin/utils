import {
  Db,
  Decimal128,
  Double,
  Filter,
  Long,
  MongoClient,
  ObjectId
} from "mongodb";
import { isDeepStrictEqual } from "util";
import { fill } from "./array";
import { abortize, sleep, toArray } from "./async";
import { dbUrl } from "./config";
import { timer } from "./durate";
import { idfn, nop } from "./fn";
import { $max } from "./group-ops";
import { reparse } from "./json";
import { minmax } from "./math";
import { createIndexes } from "./mongo-indexes";
import {
  appendCollection,
  bulkWrite,
  CollectionReadOnly,
  CollectionWriteable,
  count,
  desugarQuery,
  distinct,
  distinctAggregate,
  duplicatesPipeline,
  findOneAndReplace,
  findOneAndUpdate,
  getDuplicates,
  getDuplicatesCount,
  getMaxUpdated,
  insertMany,
  insertOne,
  insertOneOrUpsert,
  prettifyExplanation,
  replaceOne,
  reviveOid,
  reviveOids,
  updateMany,
  updateOne
} from "./mongo-ops";
import { recreateCollection, sync4tests } from "./mongo-sync";
import { entrize } from "./object";
import type {
  Id,
  Mutate,
  RecordND,
  Schema2Ts
} from "./ts-utils.types";

type Item = {
  "prop": {
    "v": 0
    "value": number
  },
  "v": 0
}

type Nested = RecordND<[
  "sources", string, string
], Item>

const {defineProperty: $defineProperty} = Object

let mongo: MongoClient
, db: Db

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()
  db = mongo.db()
})
afterAll(async () => await mongo.close())

const map: Nested[] = [{
  "sources": {
    "d1": {
      "r1": {"prop": {"value": 0, "v": 0}, "v": 0},
      "r2": {"prop": {"value": 1, "v": 0}, "v": 0}
    }
  }
}, {
  "sources": {
    "d1": {"r1": {"prop": {"value": 0, "v": 0}, "v": 0}},
    "d2": {"r2": {"prop": {"value": 0, "v": 0}, "v": 0}}
  }
}, {
  "sources": {
    "d2": {
      "r1": {"prop": {"value": 1, "v": 0}, "v": 0},
      "r2": {"prop": {"value": 1, "v": 0}, "v": 0}
    }
  },
}]

describe("Experiments", () => {
  const collections = {} as {
    "nested": CollectionWriteable<Nested>
    "entries": CollectionWriteable
    "flat": CollectionWriteable<{"sources": Item[]}>
    "indexing": CollectionWriteable
  }

  beforeAll(async () => {

    collections.nested = await appendCollection(db, "nested")
    collections.entries = await appendCollection(db, "entries")
    collections.flat = await appendCollection(db, "flat")
    collections.indexing = await appendCollection(db, "indexing")
  })

  describe("nestObject", () => {
    beforeAll(async () => {
      await collections.nested.deleteMany({})

      await insertMany(collections.nested, map, {
        "forceServerObjectId": true
      })
    })

    it("filter", async () => {
      function filter(collection: CollectionReadOnly<Nested>, item: Filter<Item>) {
        return collection.aggregate([
          {$addFields: {
            "s": {$objectToArray: "$sources"},
          }},
          {$unwind: "$s"},
          {$addFields: {
            "s": {$objectToArray: "$s.v"}
          }},

          {$match: {
            "s": {$elemMatch: {
              // Doesn't work "v": item
              // Doesn't "v.prop": item.value,
              "v.prop.value": item.prop!.value
            }}
          }},

          {$group: {
            _id: "$_id",
            "sources": {$first: "$sources"}
          }}
        ])
      }

      expect(
        await filter(collections.nested, {"prop": {"value": 0}})
        .sort({_id: 1}).toArray()
      ).toMatchObject([
        map[0],
        map[1]
      ])

      expect(
        await filter(collections.nested, {"prop": {"value": 1}})
        .sort({_id: 1}).toArray()
      ).toMatchObject([
        map[0],
        map[2]
      ])

      expect(
        await filter(collections.nested, {"prop": {"value": 2}})
        .sort({_id: 1}).toArray()
      ).toMatchObject(
        []
      )
    })
  })

  describe("entries", () => {
    const items = map.map(({sources}) => ({"sources": entrize(sources, 2, true)}))

    beforeAll(async () => {
      await collections.entries.deleteMany({})

      function toBSON(this: Nested) {
        const {sources} = this
        , nextSources = entrize(sources, 2, true)

        return {
          ...this,
          "sources": nextSources
        }
      }

      const descriptor = {
        "enumerable": false,
        "value": toBSON
      }

      await insertMany(collections.entries,
        map.map(obj => {
          const clone = {...obj}

          $defineProperty(clone, "toBSON", descriptor)

          return clone
        }), {
        "forceServerObjectId": true
      })
    })

    it("filter", async () => {
      const {entries} = collections

      function filter(collection: CollectionReadOnly, value: number) {
        return collection.find({
          "sources.v.v.prop.value": value
        })
      }

      expect(await filter(entries, 0).toArray()).toMatchObject([
        items[0],
        items[1]
      ])

      expect(await filter(entries, 1).toArray()).toMatchObject([
        items[0],
        items[2]
      ])

      expect(await filter(entries, 2).toArray()).toMatchObject(
        []
      )
    })
  })

  describe("flat", () => {
    const items = map.map(({sources}) => ({"sources": entrize(sources, 2, false).flat(1)}))

    beforeAll(async () => {
      await collections.flat.deleteMany({})

      function toBSON(this: Nested) {
        const {sources} = this
        , nextSources = entrize(sources, 2, false).flat(1)

        return {
          ...this,
          "sources": nextSources
        }
      }

      const descriptor = {
        "enumerable": false,
        "value": toBSON
      }

      await insertMany(collections.flat,
        //@ts-expect-error
        map.map(obj => {
          const clone = {...obj}
          $defineProperty(clone, "toBSON", descriptor)

          return clone
        }), {
        "forceServerObjectId": true
      })
    })

    it("filter", async () => {
      const {flat} = collections

      function filter(collection: CollectionReadOnly<{"sources": Item[]}>, value: number) {
        return collection.find({
          "sources.prop.value": value
        })
      }

      expect(await filter(flat, 0).toArray()).toMatchObject([
        items[0],
        items[1]
      ])

      expect(await filter(flat, 1).toArray()).toMatchObject([
        items[0],
        items[2]
      ])

      expect(await filter(flat, 2).toArray()).toMatchObject(
        []
      )
    })
  })

  // Sort out
  describe("Long queue", () => {
    const count = 2 * 10**5
    let collection: CollectionWriteable<{
      "random": number
    }>


    beforeAll(async () => {
      collection = await appendCollection(mongo.db(), "long")
      await collection.deleteMany({})

    })

    it("fill", async () => {
      await collection.deleteMany({})

      // 10 ** 5 : 1.5 sec
      // 5 * 10 ** 5 - 6 sec
      // 10 ** 6 : 12 sec
      await insertMany(collection, fill(count, () => ({"random": Math.random()})), {
        // "maxTimeMS": 10,
      })

    })

    describe(abortize.name, () => {
      function makeTimeout(controller: AbortController, timeout: number) {
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        return () => clearTimeout(timeoutId)
      }

      it("break toArray", async () => {
        const controller = new AbortController()
        , {signal} = controller
        , flushTimeout = makeTimeout(controller, 100)

        let x: unknown[] = [], e

        try {
          x = await abortize(signal, collection.find({})).toArray()
        } catch(err) {
          err = e
        }

        flushTimeout()

        expect(x.length).toBeLessThan(count)
        expect(e).not.toBeDefined()
      })

      it("break iter", async () => {
        const controller = new AbortController()
        , {signal} = controller
        , flushTimeout = makeTimeout(controller, 100)

        let x: unknown[] = [], e

        try {
          for await (const item of abortize(signal, collection.find({}))) {
            x.push(item)
          }
        } catch(err) {
          err = e
        }

        flushTimeout()

        expect(x.length).toBeLessThan(count)
        expect(e).not.toBeDefined()
      })


      it("ok", async () => {
        const controller = new AbortController()
        , {signal} = controller
        , delay = 1000
        , flushTimeout = makeTimeout(controller, delay)

        const x = await abortize(signal, collection.find({})).limit(10).toArray()

        await sleep(delay)

        flushTimeout()

        expect(x.length).toBeLessThan(count)
      })
    })

    describe.skip("default mongo timeouts", () => {
      it("timeout @ aggregate", async () => {
        await collection.aggregate([{"$group": {
          _id: null,
          "cnt": {"$sum": 1},
          "sum": {"$sum": "$random"}
        }}], {
          "maxTimeMS": 1,
          "maxAwaitTimeMS": 1
        }).toArray()
      })

      it("timeout @ find", async () => {
        await collection.find({"random": {"$lte": 0.001}}, {
          "maxAwaitTimeMS": 1,
          "maxTimeMS": 1
        }).toArray()
      })

      it("timeout @ updateMany", async () => {
        await collection.updateMany({"random": {"$lte": 0.001}}, {
          "$inc": {"random": 1}
        }, {
          "maxTimeMS": 1
        })
      })

      it("timeout @ updateMany", async () => {
        await collection.updateMany({"random": {"$lte": 0.001}}, {
          "$inc": {"random": 1}
        }, {
          "maxTimeMS": 1
        })
      })

      it("fill2", async () => {
        const client = await new MongoClient(dbUrl, {
          "waitQueueTimeoutMS": 100
        }).connect()
        , collection = await appendCollection(client.db(undefined), "long")

        await collection.deleteMany({})

        await insertMany(collection, fill(2 * 10 ** 5, () => ({"random": Math.random()})), {
          "maxTimeMS": 10,
        })

        await client.close()
      })
    })
  })
})

it(appendCollection.name, async () => {
  const collectionName = `test-${appendCollection.name}`
  await db.dropCollection(collectionName).catch(nop)

  await insertMany(
    await appendCollection(db, collectionName),
    [{}]
  )

  const before = await count(db.collection(collectionName))
  await appendCollection(db, collectionName)
  const after = await count(db.collection(collectionName))

  expect(after).toBe(before)
})

describe("Utils", () => {
  describe(desugarQuery.name, () => {
    it("null", () => expect(desugarQuery(null)).toStrictEqual({"_id": null}))

    it("oid", () => expect(desugarQuery(
      `${new ObjectId()}`
    )).toStrictEqual({"_id": expect.any(ObjectId)}))

    it("ObjectId", () => expect(desugarQuery(
      new ObjectId()
    )).toStrictEqual({"_id": expect.any(ObjectId)}))

    it("query", () => expect(desugarQuery({
      "_id": {"$in": []}
    })).toStrictEqual({
      "_id": {"$in": []}
    }))
  })

  describe(reviveOid.name, () => {
    type MyId = Id<"my">

    it("ts", () => {
      const myId = `${new ObjectId()}` as MyId|ObjectId
      , dup: MyId = reviveOid(myId).toString()

      dup
    })
  })

  describe(reviveOids.name, () => {
    it("null", () => expect(reviveOids(null)).toBe(null))

    it("not changed", () => expect(reviveOids([
      null,
      true,
      {},
      []
    ])).toStrictEqual([
      null,
      true,
      {},
      []
    ]))

    it("string", () => {
      const oid = new ObjectId()
      , options = [
        oid,
        oid.toJSON(),
        oid.toString(),
        oid.toHexString()
      ]

      expect(reviveOids(options)).toStrictEqual(
        fill(options.length, oid)
      )
    })

    it("number is bad", () => {
      const timestamp = Date.now()
      , objectId = new ObjectId()
      , oid = `${objectId}`
      , val = +objectId
      , time = objectId.generationTime
      , date = objectId.getTimestamp()
      , recovered = `${ObjectId.createFromTime(+ date / 1000)}`
      , seconds = Math.round(timestamp / 1000)

      expect({val, time, date, recovered}).toStrictEqual({
        "val": NaN,
        "time": minmax(
          time,
          seconds - 1,
          seconds
        ),
        "date": new Date(time * 1000),
        "recovered": `${
          oid.substring(0, 8)
        }${
          "0".repeat(oid.length - 8)
        }`
      })
    })
  })
})

describe("Read ops", () => {
  describe("duplications", () => {
    const count = 300000
    , keys = {
      "u1": 1,
      "u2": 1
    } as const

    type Item = Record<keyof typeof keys, string>

    let collection: CollectionWriteable<Item>

    describe("unique", () => {
      beforeAll(async () => {
        collection = await recreateCollection(db, "test-duplications")

        const subLength = Math.round(`${count - 1}`.length / 2)
        //@ts-expect-error
        await insertMany(collection, fill(count, i => ({
          "u1": `${i}`.substring(0, subLength),
          "u2": `${i}`.substring(subLength),
        })))
      })

      it(getDuplicates.name, async () => {
        const duplicates = await getDuplicates(collection, keys).toArray()

        expect(duplicates).toStrictEqual([])
      })

      it(getDuplicatesCount.name, async () => {
        const duplicates = await getDuplicatesCount(collection, keys)

        expect(duplicates).toStrictEqual(null)
      })

      it("sort + group + count", async () => {
        const duplicates = await collection.aggregate([
          {"$sort": keys},
          {"$group": {
            "_id": Object.keys(keys).map(k => `$${k}`),
            "count": {"$sum": 1},
            "items": {"$push": "$$ROOT"}
          }},
          {"$match": {
            "count": {"$gt": 1}
          }}
        ], {"allowDiskUse": true}).toArray()

        expect(duplicates).toStrictEqual([])
      })

      it("sort + filter", async () => {
        const duplicates: {
          "key": Item,
          "elements": Item[]
        }[] = []

        for await (const item of collection.find<Item & {"d": Item}>({}, {
          "sort": keys,
          "projection": {
            "_id": 0,
            ...keys,
            "d": "$$ROOT"
          },
          "allowDiskUse": true
        })) {
          const {d} = item
          //@ts-ignore `Mutate` issue
          , key = item as Mutate<typeof item, Item>
          , {length} = duplicates

          delete key.d

          if (length === 0) {
            duplicates.push({
              key,
              "elements": [d]
            })

            continue
          }

          const pre = duplicates[length - 1]
          , {elements} = pre

          if (isDeepStrictEqual(key, pre.key)) {
            elements.push(d)
          } else {
            if (elements.length === 1)
              duplicates.length--

            duplicates.push({
              key,
              "elements": [d]
            })
          }
        }

        if (duplicates[duplicates.length - 1].elements.length === 1)
          duplicates.length--

        expect(duplicates).toStrictEqual([])
      })

      it.todo("$setWindowFunction")
    })

    describe("many small duplications", () => {})

    describe("few huge duplications", () => {})

    describe("functional", () => {
      const items = [
        {"u1": "a", "u2": "a"},
        {"u1": "a", "u2": "b"},
      ] as const

      beforeAll(async () => {
        collection = await recreateCollection(db, "duplications")

        await insertMany(collection, items)
      })

      describe("unique", () => {
        it(getDuplicatesCount.name, async () => expect(
          await getDuplicatesCount(collection, {"u2": 1}, {"u1": "a"})
        ).toBe(null))

        it(getDuplicates.name, async () => expect(
          await toArray(getDuplicates(collection, {"u2": 1}, {"u1": "a"}))
        ).toStrictEqual([]))
      })

      describe("not unique", () => {
        it(getDuplicatesCount.name, async () => expect(
          await getDuplicatesCount(collection, {"u1": 1}, {"u1": "a"})
        ).toStrictEqual({
          "count": 1,
          "total": items.length
        }))

        it(getDuplicates.name, async () => expect(
          await toArray(getDuplicates(collection, {"u1": 1}, {"u1": "a"}))
        ).toStrictEqual([{
          "c": items.length,
          "k": {"u1": "a"},
          "i": items.map(item => ({
            ...item,
            "_id": expect.any(ObjectId)
          }))
        }]))

        it(duplicatesPipeline.name, async () => expect(await collection.aggregate(
          duplicatesPipeline({}, {"$limit": 1})
        ).toArray()).toStrictEqual(
          [{"c": 2}]
        ))
      })
    })
  })

  describe(getMaxUpdated.name, () => {
    type Item = {
      "value"?: string
      "updatedAt": Date
    }

    let collection: CollectionWriteable<Item>

    beforeAll(async () => {
      collection = await recreateCollection(db, `test-${getMaxUpdated.name}`)
    })

    it("on empty", async () => expect(
      await getMaxUpdated(collection)
    ).toBe(undefined))

    it("with $match", async () => {
      const dates = fill(3, () => new Date()).reverse()
      , value = "abc"
      , items = dates.map(updatedAt => ({value, updatedAt}))
      await insertMany(collection, items)

      expect(await getMaxUpdated(collection, {value})).toStrictEqual(
        $max(...dates)
      )
    })

    it("all", async () => {
      const dates = fill(3, () => new Date()).reverse()
      , items = dates.map(updatedAt => ({updatedAt}))
      await insertMany(collection, items)

      expect(await getMaxUpdated(collection)).toStrictEqual(
        $max(...dates)
      )
    })
  })

  describe(distinct.name, () => {
    type Item = {"value": string | (string | (string | (string | string[])[])[])[]}
    let collection: CollectionWriteable<Item>

    const prepare = async (items: Item[][]) => {
      collection = await recreateCollection(db, `test-${distinct.name}`)

      await createIndexes(collection, {
        "value1": {
          "key": {"value": 1},
        },
      })

      await Promise.all(items.map(chunk => insertMany(collection, chunk)))
    }

    describe(distinctAggregate.name, () => {
      const fns = [
        (c: typeof collection, ...args: Parameters<typeof collection["distinct"]>) => c.distinct(...args),
        distinctAggregate
      ]

      it("work with 1d array", async () => {
        await prepare([[
          {"value": "a"},
          {"value": "b"},
          {"value": ["a", "b"]},
          {"value": [["a"], ["b"], ["c", "d"], ["e", "f"]]},
        ]])

        //@ts-expect-error
        const [native, fallback] = await Promise.all(fns.map(fn => fn(collection, "value", {}) as Promise<Item[]>))

        native.sort()
        fallback.sort()

        expect(fallback).toStrictEqual(native)
      })

      it("Too deep array", async () => {
        await prepare([[
          {"value": [[["a", "b"], "c"], ["d", ["e", ["f", "g"]]]]},
          {"value": [[["a", "b"]]]},
          {"value": [["c"]]},
          {"value": [["d"]]},
          {"value": [["c"], ["d"]]},
          {"value": [["c", "d"]]},
          {"value": [["d", ["e", ["f", "g"]]]]},
        ]])

        //@ts-expect-error
        const [native, fallback] = await Promise.all(fns.map(fn => fn(collection, "value", {}) as Promise<Item[]>))

        native.sort()
        fallback.sort()

        expect({native, fallback}).toStrictEqual({
          "fallback": native,
          "native": [
            ["a", "b"],
            "c",
            "d",
            ["e", ["f","g"]
          ]]
        })
      })

      it("performance", async () => {
        //@ts-expect-error
        await prepare(fill(30, i => fill(535,
          j => ({"value": `${"0".repeat(1024)}-${i}-${j}`})
        )))

        const [native, fallback] = await Promise.all(
          fns.map(async fn => {
            const end = timer()
            //@ts-expect-error
            , items: unknown[] = await fn(collection, "value", {})
            , duration = end()

            items.sort()

            return {
              items,
              "length": items.length,
              "seconds": Math.round(duration) / 1000
            }
          })
        )
        , ratio = fallback.seconds / native.seconds

        expect({
          "length": fallback.length,
          ratio
        }).toStrictEqual({
          "length": native.length,
          "ratio": minmax(
            ratio,
            1.15,
            5
          )
        })
        expect(fallback.items).toStrictEqual(native.items)
      })
    })

    describe(distinct.name, () => {
      it("as fallback", async () => {
        //@ts-expect-error
        await prepare(fill(30, i => fill(540,
          j => ({"value": `${"0".repeat(1024)}-${i}-${j}`})
        )))

        const native = await collection.distinct("value", {}).then(nop).catch(idfn)
        , length = await distinct(collection, "value", {}).then(arr => arr.length)

        expect({native, length}).toStrictEqual({
          "native": expect.any(Error),
          "length": 30 * 540
        })
      })
    })
  })

  describe(count.name, () => {
    type Item = {"value": string}
    let collection: CollectionWriteable<Item>

    beforeAll(async () => {
      collection = await recreateCollection(db, `test-${count.name}`)
      await createIndexes(collection, {
        "value1": {"key": {"value": 1}}
      })

      await insertMany(collection, [
        {"value": "a1"},
        {"value": "a2"},
        {"value": "a2"},
        {"value": "a3"},
        {"value": "a3"},
        {"value": "a3"},
      ])
    })

    it("just count", async () => expect(await count(
      collection
    )).toBe(6))

    it("limit", async () => expect(await count(collection,
      undefined, {"limit": 3}
    )).toBe(3))

    it("match", async () => expect(await count(collection,
      {"value": "a3"}
    )).toBe(3))

    it("match + limit", async () => expect(await count(collection,
      {"value": "a3"}, {"limit": 2}
    )).toBe(2))
  })

  describe(prettifyExplanation.name, () => {
    const hint = "value"

    type Item = {"value": string}
    let collection: CollectionWriteable<Item>

    beforeAll(async () => {
      collection = await recreateCollection(db, `test-${prettifyExplanation.name}`)
      await createIndexes(collection, {
        [hint]: {
          "key": {"value": 1},
          // "unique": true
        }
      })

      await insertMany(collection, [
        {"value": "a1"},
        {"value": "a2"},
        {"value": "a3"},
      ])
    })

    it("find no match without hint", async () => {
      const explanation = prettifyExplanation(await collection.find({}, {
        "projection": {"_id": 0, "value": 1},
      }).explain())

      expect(explanation.sumup).toStrictEqual({
        "indexNames": [],
        "executionStats": {
          "nReturned": 3,
          "totalDocsExamined": 3,
          "totalKeysExamined": 0
        }
      })
    })

    it("find exists without hint", async () => {
      const explanation = prettifyExplanation(await collection.find({"value": {"$exists": true}}, {
        "projection": {"_id": 0, "value": 1},
      }).explain())

      expect(explanation.sumup).toStrictEqual({
        "indexNames": [hint],
        "executionStats": {
          "nReturned": 3,
          "totalDocsExamined": 3,
          "totalKeysExamined": 3
        }
      })
    })

    describe("no docs were used", () => {
      const sumup = {
        "indexNames": [hint],
        "executionStats": {
          "nReturned": 3,
          "totalKeysExamined": 3,
          "totalDocsExamined": 0,
        }
      }

      it("find type without hint", async () => {
        const explanation = prettifyExplanation(await collection.find({"value": {"$type": "string"}}, {
          "projection": {"_id": 0, "value": 1},
        }).explain())

        expect(explanation.sumup).toStrictEqual(sumup)
      })

      it("find ne null without hint", async () => {
        const explanation = prettifyExplanation(await collection.find({"value": {"$ne": null as any}}, {
          "projection": {"_id": 0, "value": 1},
        }).explain())

        expect(explanation.sumup).toStrictEqual(sumup)
      })

      it("find no match with hint", async () => {
        const explanation = prettifyExplanation(await collection.find({}, {
          "projection": {"_id": 0, "value": 1},
          hint
        }).explain())

        expect(explanation.sumup).toStrictEqual(sumup)
      })

      it("distinct", async () => {
        const explanation = prettifyExplanation(await collection.distinct("value", {}, {"explain": true}))

        expect(explanation.sumup).toStrictEqual(sumup)
      })
    })
  })
})

describe("Write ops", () => {
  const jsonSchema = {
    "type": "object",
    "additionalProperties": false,
    "required": ["req"],
    "properties": {
      "_id": {},
      "req": {"type": "string"},
      "opt": {"type": "string"},
      "updatedAt": {},
    }
  } as const

  let collection: CollectionWriteable<Schema2Ts<typeof jsonSchema>>

  beforeAll(async () => {
    const synced = await sync4tests(db, {
      "write": {
        "collection": "test-mongo-write",
        "indexes": {
          "un_req1": {"key": {"req": 1}, "unique": true},
          "opt1": {"key": {"opt": 1}}
        },
        jsonSchema
      }
    })

    collection = synced.write
  })

  describe("smoke", () => {
    const item0 = {"req": "a"}
    , item1 = {"req": "b"}
    , item2 = {"req": "c"}
    , item3 = {"req": "d"}
    , invalid = {"invalid": true} as unknown as typeof item1

    beforeEach(async () => {
      await collection.deleteMany({})
      await insertMany(collection, [item0, item1])
    })

    it(prettifyExplanation.name, async () => {
      const invalid2 = {"req": 1} as any
      , err = await insertMany(collection, [invalid, invalid2])
      .then(nop).catch(idfn)
      , writeErrors = [
        {
          "failingDocumentId": expect.any(ObjectId),
          "operatorName": "$jsonSchema",
          "schemaRulesNotSatisfied": [{
            "operatorName": "additionalProperties",
            "specifiedAs": {"additionalProperties": false},
            "additionalProperties": ["invalid"]
          }, {
            "operatorName": "required",
            "specifiedAs": {"required": ["req"]},
            "missingProperties": ["req"]
          }],
          "op": invalid
        },
        {
          "failingDocumentId": expect.any(ObjectId),
          "operatorName": "$jsonSchema",
          "schemaRulesNotSatisfied": [{
              "operatorName": "properties",
              "propertiesNotSatisfied": [{
                "propertyName": "req",
                "details": [{
                  "operatorName": "type",
                  "specifiedAs": {"type": "string"},
                  "reason": "type did not match",
                  "consideredValue": 1,
                  "consideredType": "int"
                }]
              }]
            }
          ],
          "op": invalid2
        }
      ]

      expect(err).toMatchObject({
        "stack": expect.stringContaining("/mongo-ops."),
        "code": 121,
        "failingDocumentId": expect.any(ObjectId),
        "operatorName": "$jsonSchema",
        "op": invalid,
        "errmsg": "Document failed validation",
        "collection": collection.collectionName,
        writeErrors,
        "result": {
          "ok": 1,
        },
        "schemaRulesNotSatisfied": writeErrors[0].schemaRulesNotSatisfied,
        "errors": writeErrors
      })
    })

    describe("valid", () => {
      it(bulkWrite.name, () => expect(bulkWrite(collection,
        [{"insertOne": {"document": item2}}]
      ).then(reparse)).resolves.toMatchObject(reparse(
        {"insertedIds": [{"_id": undefined, "index": 0}]}
      )))

      it(insertOne.name, () => expect(insertOne(collection,
        item2
      )).resolves.toMatchObject({"insertedId": undefined}))

      it(insertMany.name, () => expect(insertMany(collection,
        [item2]
      )).resolves.toMatchObject({"insertedIds": {"0": undefined}}))

      it(updateOne.name, () => expect(updateOne(collection,
        item1, {"$set": item2}
      )).resolves.toMatchObject({"modifiedCount": 1}))

      it(updateOne.name, () => expect(updateMany(collection,
        item1, {"$set": item2}
      )).resolves.toMatchObject({"modifiedCount": 1}))

      it(findOneAndUpdate.name, () => expect(findOneAndUpdate(collection,
        item1, {"$set": item2}
      )).resolves.toMatchObject(item2))

      it(findOneAndUpdate.name, () => expect(findOneAndUpdate(collection,
        item1, [{"$set": item2}]
      )).resolves.toMatchObject(item2))

      it(replaceOne.name, () => expect(replaceOne(collection,
        item1, item2
      )).resolves.toMatchObject({"modifiedCount": 1}))

      it(findOneAndReplace.name, () => expect(findOneAndReplace(collection,
        item1, item2
      )).resolves.toMatchObject(item2))

      it(insertOneOrUpsert.name, () => expect(insertOneOrUpsert(collection,
        item3
      )).resolves.toMatchObject(item3))
    })

    describe("invalid", () => {
      const err1 = {
        "operatorName": "additionalProperties",
        "additionalProperties": ["invalid"]
      }
      , errorInfo1 = {
        "schemaRulesNotSatisfied": [err1]
      }
      , errorInfo2 = {
        "schemaRulesNotSatisfied": [err1, {
          "operatorName": "required",
          "missingProperties": ["req"]
        }]
      }

      it(bulkWrite.name, () => expect(bulkWrite(collection,
        [{"insertOne": {"document": invalid}}]
      ).then(reparse)).rejects.toMatchObject(errorInfo2))

      it(insertOne.name, () => expect(insertOne(collection,
        invalid
      )).rejects.toMatchObject(errorInfo2))

      it(insertMany.name, () => expect(insertMany(collection,
        [invalid]
      )).rejects.toMatchObject(errorInfo2))

      it(updateOne.name, () => expect(updateOne(collection,
        item1, {"$set": invalid}
      )).rejects.toMatchObject(errorInfo1))

      it(updateOne.name, () => expect(updateMany(collection,
        item1, {"$set": invalid}
      )).rejects.toMatchObject(errorInfo1))

      it(insertOneOrUpsert.name, () => expect(insertOneOrUpsert(collection,
        invalid
      )).rejects.toMatchObject(errorInfo2))

      it(findOneAndUpdate.name, () => expect(findOneAndUpdate(collection,
        item1, {"$set": invalid}
      )).rejects.toMatchObject(errorInfo1))

      it(findOneAndUpdate.name, () => expect(findOneAndUpdate(collection,
        item1, [{"$set": invalid}]
      )).rejects.toMatchObject(errorInfo1))

      it(replaceOne.name, () => expect(replaceOne(collection,
        item1, invalid
      )).rejects.toMatchObject(errorInfo2))

      it(findOneAndReplace.name, () => expect(findOneAndReplace(collection,
        item1, invalid
      )).rejects.toMatchObject(errorInfo2))
    })
  })
})

describe("BSON types demo", () => {
  describe(Double.name, () => {
    it("toJSON", () => expect(
      new Double(0).toJSON()
    ).toBe(0))

    it("valueOf", () => expect(
      +new Double(0)
    ).toBe(0))
  })

  describe(Long.name, () => {

    it("JSON reparse", () => expect(reparse(
      {...new Long(0)}
    )).toStrictEqual(
      {"high": 0, "low": 0, "unsigned": false}
    ))

    it("Reparse with injection", () => expect(reparse(
      new Long(0)
    )).toBe(
      0
    ))

    it("valueOf", () => expect(
      +new Long(0)
    ).toBe(0))
  })

  describe(Decimal128.name, () => {
    it("toJSON ", () => expect(
      //@ts-expect-error
      new Decimal128("0").toExtendedJSON()
    ).toStrictEqual(
      {"$numberDecimal": "0"}
    ))

    it("toJSON", () => expect(
      new Decimal128("0").toJSON()
    ).toBe(
      0
    ))

    it("valueOf", () => expect(
      +new Decimal128("0")
    ).toBe(0))    
  })
})
