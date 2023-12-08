import { Db, MongoClient } from "mongodb";
import { fill } from "./array";
import { parallel } from "./async";
import { dbUrl } from "./config";
import {
  appendCollection,
  CollectionWriteable
} from "./mongo-ops";

let mongo: MongoClient
, db: Db

const collections = {} as {
  "parallel": CollectionWriteable<{
    "v": number
  }>
}

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()

  db = mongo.db()

  collections.parallel = await appendCollection(db, "parallel")
})
afterAll(async () => await mongo.close())

describe(parallel.name, () => {
  const count = 5
  beforeAll(async () => {
    const parallelCollection = collections.parallel

    await parallelCollection.deleteMany({})
    await parallelCollection.insertMany([
      ...fill(count, i => ({v: 1, i})),
      ...fill(count, i => ({v: 2, i})),
    ], {
      "forceServerObjectId": true
    })  
  })

  it("demo", async () => {
    const parallelCollection = collections.parallel
    , vs: number[] = []

    for await (const {v} of parallel([
      parallelCollection.find({v: 1}),
      parallelCollection.find({v: 2})
    ]))
      vs.push(v)

    expect(vs.sort()).toStrictEqual([
      ...fill(count, 1),
      ...fill(count, 2)
    ])
  })
})
