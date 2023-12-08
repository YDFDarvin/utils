import { Injectable, Module } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  Collection,
  ObjectId
} from "mongodb"
import type { Model } from "mongoose"
import {
  dbUrl,
  port
} from "./config"
import { createHttpApi } from "./http-api"
import {
  findOneAndReplace,
  findOneAndUpdate,
  reviveOid
} from "./mongo-ops"
import {
  createNestHttp,
  HttpController
} from "./nest-http"
import { mongooseModules } from "./nest-mongo"
import { project } from "./object"
import type { RestInterface } from "./rest"
import type {
  Arg0,
  EmptyObject, Return,
  Schema2Ts
} from "./ts-utils.types"

const base = `http://localhost:${port}`

describe(createNestHttp.name, () => {
  let app: Return<typeof createNestHttp>

  const client = createHttpApi({
    base,
    "entity": "entity",
    "idKey": "id"
  })
  , items: (Item & MyId)[] = []

  beforeAll(async () => {
    app = await createNestHttp(MyModule, {port})
    await app.start()

    await app.app.get(Service).collection.deleteMany({})
  })
  afterAll(async () => app.close())

  it("1. find", async () => expect(
    await client.find({})
  ).toStrictEqual({
    "count": 0,
    "items": []
  }))

  it("2.1 create", async () => {
    //@ts-expect-error
    items.push(await client.create({"value": 1}))
    //@ts-expect-error
    items.push(await client.create({"value": 2}))

    expect(items).toStrictEqual([
      {"value": 1},
      {"value": 2}
    ].map(item => ({
      ...item,
      "id": expect.any(String),
      "updatedAt": expect.any(String),
    })))
  })

  it("2.2 create invalid", async () => {
    const invalid = await client.create({"val": 1})

    expect(invalid.statusCode).toBeGreaterThanOrEqual(400)
  })

  it("3. find", async () => expect(
    await client.find({})
  ).toStrictEqual({
    "count": items.length,
    items
  }))

  it("4. delete", async () => expect(await Promise.all(items.map(item =>
    client.delete(item)
  ))).toStrictEqual(items.map(() => ({
    "deleted": 1
  }))))
})

const recordSchema = {
  "type": "object",
  "required": ["_id", "value"],
  "properties": {
    "_id": {"readOnly": true, "$ts": "ObjectId"},
    "value": {"type": "integer"},
  }
} as const
, payloadId = {
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {"$ts": "ObjectId", "readOnly": true}
  }
} as const

type Record = Schema2Ts<typeof recordSchema, {"ObjectId": ObjectId}>
type MyId = Schema2Ts<typeof payloadId, {"ObjectId": ObjectId}>
type Item = Omit<Record, "_id"|"updatedAt"|"userId">

type ServiceInterface = RestInterface<
  EmptyObject,
  {
    "id": MyId
    "dto": Item
  }
>

@Injectable()
class Service implements ServiceInterface {
  @InjectModel("model") readonly model!: Model<Record>

  get collection() {
    //@ts-expect-error
    return this.model.collection.collection as Collection<Record>
  }

  async create(item: Arg0<ServiceInterface["create"]>) {
    const record = await findOneAndUpdate(this.collection, {_id: {$exists: false}}, {"$setOnInsert": item}, {"upsert": true})
    , prettified = _id2id(record!)
    return prettified
  }

  async find(q: Arg0<ServiceInterface["find"]>) {
    const items = await this.collection.find(q).map(_id2id).toArray()
    return {
      "count": items.length,
      "items": items as any[]
    }
  }

  async get({id}: Arg0<ServiceInterface["get"]>) {
    return await this.collection.find({"_id": reviveOid(id)}, {"limit": 1})
    .map(_id2id)
    .toArray()
    .then(arr => arr[0] ?? null)
  }

  async replace(payload: Arg0<ServiceInterface["replace"]>) {
    const {
      id,
      ...$set
    } = payload
    return _id2id(await findOneAndReplace(this.collection, {"_id": reviveOid(id)}, $set))
  }

  async update(payload: Arg0<ServiceInterface["update"]>) {
    const {
      id,
      ...$set
    } = payload
    return _id2id(await findOneAndUpdate(this.collection, {"_id": reviveOid(id)}, {$set}))
  }

  async delete({id}: Arg0<ServiceInterface["delete"]>) {
    const {deletedCount} = await this.collection.deleteOne({_id: reviveOid(id)})
    return {"deleted": deletedCount}
  }
}

class MyController extends HttpController(Service, {
  "entity": "entity",
  "idKey": "id",
  "schema": recordSchema,
  //@ts-expect-error
  "id": payloadId,
}) {}

@Module({
  "imports": mongooseModules({
    "db": {
      "url": dbUrl,
      "opts": {},
      "models": {"model": {
        "collection": "test-rest",
        "jsonSchema": {
          "type": "object"
        }
      }}
    }
  }),
  "providers": [Service],
  "controllers": [MyController]
})
class MyModule {}

function _id2id<S extends undefined|null|{"_id": any}>(source: S) {
  if (!source)
    return source as Extract<S, undefined|null>

  const {_id} = source
  , item = project(source as {"_id": any}, {"_id": 0}) as Omit<typeof source, "_id"> & {"id": typeof source["_id"]}

  item.id = _id

  return item
}
