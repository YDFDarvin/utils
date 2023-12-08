import {
  AggregateOptions,
  AnyBulkWriteOperation,
  BulkWriteOperationError,
  BulkWriteOptions,
  Collection,
  Db,
  Decimal128,
  DistinctOptions,
  Filter,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  Long,
  MatchKeysAndValues,
  MongoBulkWriteError,
  MongoClient,
  ObjectId,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  WriteError
} from "mongodb"
import { arrayize } from "./array"
import { deleteUndefined } from "./assoc"
import { isTruthy } from "./fn"
import {
  EMPTY_OBJECT,
  forIn
} from "./object"
import type {
  AnyObject,
  Arg1,
  Dict,
  Ever,
  falsy,
  OmitStrict,
  Partest,
  ProjectStrict
} from "./ts-utils.types"

//@ts-expect-error
Long.prototype.toJSON = function (this: Long) {
  return this.toNumber()
}
//@ts-ignore
Decimal128.prototype[Long.prototype.toExtendedJSON.name] = Decimal128.prototype.toJSON
//@ts-expect-error
Decimal128.prototype.toJSON = function (this: Decimal128) {
  return +this
}

export {
  appendCollection,
  bulkWrite,
  bulkWriteOpts,
  distinct,
  duplicatesPipeline,
  distinctAggregate,
  findOneAndReplace,
  findOneAndUpdate,
  getDuplicates,
  getDuplicatesCount,
  insertMany,
  insertOne,
  insertOneOrUpsert,
  prettifyExplanation,
  replaceOne,
  setUpdatedAt,
  updateMany,
  updateOne,
  updatedAt_OLD,
  allowDiskUse,
  desugarQuery,
  getMaxUpdated,
  count,
  reviveOid,
  reviveOids
}
export type {
  CollectionReadOnly,
  CollectionWriteable,
  OptionalId,
  Oid
}

interface Oid<I extends string> extends ObjectId {
  toString(): Extract<I, string>
}

type OptionalId<T> = Omit<T, "_id"> & {"_id"?: "_id" extends keyof T ? T["_id"] : never}

type CollectionReadOnly<T extends AnyObject = Dict> = Pick<CollectionWriteable<T>,
  "aggregate"|"collectionName"|"dbName"|"distinct"|"estimatedDocumentCount"|"find"|"findOne"|"hint"|"indexExists"|"indexes"|"indexInformation"|"isCapped"|"listIndexes"|"namespace"|"options"|"readConcern"|"readPreference"|"watch"|"s"
>

type CollectionWriteable<T extends AnyObject = Dict> = OmitStrict<Collection<T>, "count"|"countDocuments"> & {
  "s"?: {
    "db": Db & {"s"?: {
      "client": MongoClient & {
        "url": string
      }
    }}
  }
}

const {
  keys: $keys,
  setPrototypeOf: $setPrototypeOf,
  defineProperties: $defineProperties
} = Object
, {
  isArray: $isArray
}= Array

const updatedAt_OLD = {"$currentDate": {"updatedAt": true}} as UpdateFilter<{"updatedAt": Date}>
, /** Doesn't work inside `$setOnInsert`*/
  setUpdatedAt = {"updatedAt": "$$NOW"} as const
, bulkWriteOpts: BulkWriteOptions = {
  "forceServerObjectId": true,
  "ordered": false
}
, {createFromHexString} = ObjectId
, allowDiskUse = {"allowDiskUse": true}

async function appendCollection<T>(db: Db, collectionName: string): Promise<CollectionWriteable<T & AnyObject>> {
  return (
    await db.listCollections({"name": collectionName}).toArray()
  ).length
  ? db.collection(collectionName)
  : db.createCollection(collectionName)
}

function getDuplicates<C extends AnyObject, K extends {[k in keyof C]?: unknown}>(
  collection: CollectionWriteable<C>,
  keys: K,
  $match?: falsy|Filter<C>,
  params = {} as {
   "timeout"?: number
  } & Omit<Arg1<typeof duplicatesPipeline>, "$count">
) {
  const dpipes = duplicatesPipeline(keys, {
    ...params,
    "$push": "$$ROOT"
  })
  , pipes = !$match ? dpipes
  : [$match && {$match}].concat(
    //@ts-expect-error
    dpipes
  )
  .filter(isTruthy)

  return collection.aggregate<{
    "k": Pick<C, Extract<keyof K, keyof C>>
    "c": number
    "i": C[]
  }>(pipes, {
    "allowDiskUse": true,
    "maxTimeMS": params.timeout
  })
}

async function getDuplicatesCount<C extends AnyObject>(
  collection: CollectionWriteable<C>,
  keys: {[k in keyof C]?: unknown},
  $match?: falsy|Filter<C>,
  params = {} as {
   "timeout"?: number
  } & Omit<Arg1<typeof duplicatesPipeline>, "$count">
) {
  const dpipes = duplicatesPipeline(keys, {
    ...params,
    "$count": true
  })
  , pipes = !$match ? dpipes
  : [$match && {$match}].concat(
    //@ts-expect-error
    dpipes
  )
  .filter(isTruthy)
  , [counts] = await collection.aggregate<{
    "count": number
    "total": number
  }>(pipes, {
    "allowDiskUse": true,
    "maxTimeMS": params.timeout
  }).toArray()

  return counts?.count ? counts : null
}

/** @internal */
function duplicatesPipeline(keys: Record<string, unknown>, {
  $push,
  $limit,
  $count
}: Partest<{
  /** On usage - check on sensitive data for your own */
  "$push": unknown
  "$limit": number
  "$count": boolean
}>) {
  const keyNames = $keys(keys)

  return [
    {"$group": deleteUndefined({
      "_id": keyNames.map(k => `$${k}`),
      "c": {"$sum": 1},
      "i": $count ? undefined : {"$push": $push || {"_": 1, "_id": 0}}
    })},
    {"$match": {
      "c": {"$gt": 1}
    }},
    $limit && {$limit},
    $count
    ? [
        {"$group": {
        "_id": null,
        "count": {"$sum": 1},
        "total": {"$sum": "$c"},
      }},
      {"$project": {
        "_id": 0
      }}
    ]
    : {"$project": {
      ...keyNames.reduce((acc, key, i) => {
        acc[`k.${key}`] = {"$arrayElemAt": ["$_id", i]}
        return acc
      }, deleteUndefined({
        "_id": 0,
        "c": 1,
        "i": $push ? 1 : undefined
      }) as Dict<AnyObject|number>)
    }}
  ]
  .flat()
  .filter(isTruthy)
}

async function insertMany<T extends AnyObject>(
  collection: CollectionWriteable<T>,
  docs: readonly OptionalId<T>[],
  options?: BulkWriteOptions
) {
  try {
      return await collection.insertMany(docs as OptionalUnlessRequiredId<T>[], {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function updateMany<T extends AnyObject>(collection: CollectionWriteable<T>,
  filter: Filter<T>,
  update: UpdateFilter<T>,
  options?: UpdateOptions
) {
  try {
      return await collection.updateMany(filter, update, {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function bulkWrite<T extends AnyObject>(
  collection: CollectionWriteable<T>,
  operations: readonly AnyBulkWriteOperation<T>[],
  options?: BulkWriteOptions
) {
  try {
      return await collection.bulkWrite(operations as AnyBulkWriteOperation<T>[], {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function insertOne<T extends AnyObject>(
  collection: CollectionWriteable<T>,
  doc: OptionalId<T>,
  options?: BulkWriteOptions
) {
  try {
      return await collection.insertOne(doc as OptionalUnlessRequiredId<T>, {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function updateOne<T extends AnyObject>(collection: CollectionWriteable<T>,
  filter: Filter<T>,
  update: UpdateFilter<T>,
  options?: UpdateOptions
) {
  try {
    return await collection.updateOne(filter, update, {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function replaceOne<T extends AnyObject>(collection: CollectionWriteable<T>,
  filter: Filter<T>,
  update: Omit<T, "_id">,
  options?: UpdateOptions
) {
  try {
    return await collection.replaceOne(filter, update, {
      ...bulkWriteOpts,
      ...options
    })
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function findOneAndReplace<T extends AnyObject>(collection: Pick<CollectionWriteable<T>, "findOneAndReplace"|"collectionName">,
  filter: Filter<T>,
  update: Omit<T, "_id">,
  options?: FindOneAndReplaceOptions
) {
  try {
    const item = await collection.findOneAndReplace(filter, update, {
      ...bulkWriteOpts,
      "returnDocument": "after",
      ...options
    })

    return item && item.value
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

async function insertOneOrUpsert<T extends AnyObject>(
  collection: CollectionWriteable<T>,
  $setOnInsert: MatchKeysAndValues<T>
) {
  return await findOneAndUpdate(collection, {_id: {$exists: false}}, {$setOnInsert}, {upsert: true});
}

async function findOneAndUpdate<T extends AnyObject, Up extends boolean, P extends ProjectStrict<T>>(
  collection: CollectionWriteable<T>,
  filter: Filter<T>,
  update: UpdateFilter<T>,
  options?: Omit<FindOneAndUpdateOptions, "upsert"|"projection"> & {
    "upsert"?: Up,
    "projection"?: P
  }
) {
  const $update = $isArray(update) ? update : deleteUndefined(update)

  try {
    const v = await collection.findOneAndUpdate(
      filter,
      $isArray($update) ? $update
      : deleteUndefined({
        ...updatedAt_OLD,
        ...$update,
      }) as UpdateFilter<T>,
      {
        ...bulkWriteOpts,
        "returnDocument": "after",
        ...options
      }
    )

    // TODO mongo^5 removes `value` nested
    return (v && v.value) as (true extends Up ? never : null) | NonNullable<typeof v>["value"]
  } catch (error: any) {
    throw prettifyMongoError(error, collection.collectionName, new Error())
  }
}

function prettifyMongoError(
  error: any,
  collectionName: string,
  error4stack: Error
) {
  const common = {
    "errmsg": error.errmsg,
    "stack": $setPrototypeOf(error4stack, MongoBulkWriteError).stack,
    "collection": collectionName
  }

  let errors: any[] = error.errors ?? []

  switch (true) {
    case (
      error.codeName === "DocumentValidationFailure"
      || error.errmsg === "Document failed validation"
    ): {

      const writeErrors = arrayize(error.writeErrors ?? {"err": error}) as WriteError[]
      , {length} = writeErrors

      errors = writeErrors

      for (let w = 0; w < length; w++)
        errors[w] = prettifyBulkError(writeErrors[w].err)

      $defineProperties(error, forIn({
        // ...prettifyBulkError(error),
        ...errors[0],
        ...errors.length > 1 && {errors},
        ...common,
      }, value => ({value, "enumerable": true})))

      break
    }
  }

  return error
}

function prettifyBulkError(err: BulkWriteOperationError) {
  const {
    op,
    "errInfo": {
      details,
      ...errEtc
    },
  } = err

  //@ts-ignore
  delete err.errInfo

  return {
    // ...etc,
    ...errEtc,
    ...details,
    op
  }
}

async function distinct<T extends AnyObject, K extends keyof T>(
  collection: CollectionReadOnly<T>,
  key: K & string,
  $match: Filter<T>,
  ops?: DistinctOptions & AggregateOptions
): Promise<Array<T[K]>> {
  try {
    return await collection.distinct(
      key,
      $match!,
      ops as DistinctOptions
    )  
  } catch (_) {
    return await distinctAggregate(collection, key, $match, ops)
  }
}

/** @internal Use `distinct()` @deprecated  */
async function distinctAggregate<T extends AnyObject, K extends keyof T>(
  collection: CollectionReadOnly<T>,
  key: K & string,
  $match: Filter<T>,
  opts?: AggregateOptions
): Promise<Array<T[K]>> {
  const path = `$${key}`

  return await collection.aggregate<{"_id": T[K]}>([
    {$match},
    {"$unwind": path},
    {"$unwind": path},
    {"$group": {"_id": path}},
  ], {
    "allowDiskUse": true,
    ...opts,
  })
  .map(get_id)
  .toArray()
}

function prettifyExplanation(explanation: AnyObject) {
  const indexNames = new Set<string>()
  , executionStats = {
    "nReturned": undefined,
    "totalDocsExamined": undefined,
    "totalKeysExamined": undefined,
  }
  , brief = JSON.parse(JSON.stringify(explanation), (k, v) => {
    switch (k) {
      // TODO Understand      
      // 'maxIndexedOrSolutionsReached',
      // 'maxIndexedAndSolutionsReached'

      case "indexName": {
        indexNames.add(v)
        break  
      }

      case "executionStats": {
        executionStats.nReturned = (executionStats.nReturned ?? 0) + v.nReturned
        executionStats.totalDocsExamined = (executionStats.totalDocsExamined ?? 0) + v.totalDocsExamined
        executionStats.totalKeysExamined = (executionStats.totalKeysExamined ?? 0) + v.totalKeysExamined
        break
      }

      case "indexesUsed": {
        //@ts-ignore
        v.forEach(x => indexNames.add(x))
        break
      }
    }

    /* istanbul ignore next: Many aggregation stages */
    return Array.isArray(v) && v.length > 5 ? [] : v
  })

  return {
    brief,
    "sumup": {
      "indexNames": Array.from(indexNames).sort(),
      "executionStats": {
        "nReturned": executionStats.nReturned,
        "totalDocsExamined": executionStats.totalDocsExamined,
        "totalKeysExamined": executionStats.totalKeysExamined,
      }
    }
  }
}

async function count<T extends AnyObject>(collection: CollectionReadOnly<T>, $match?: Filter<T>, opts?: FindOptions<T>) {
  const cursor = opts ? collection.find($match || EMPTY_OBJECT, opts)
  : $match ? collection.find($match)
  : collection.find()
  , count = await cursor.count()

  await cursor.close()

  return count
}

function desugarQuery<T>(query: null|string|ObjectId|Filter<T>) {
  const $match: Filter<T> = query === null ? {"_id": null as any}
  : typeof query === "string" ? {"_id": createFromHexString(query)}
  : query instanceof ObjectId ? {"_id": query}
  : query

  return $match
}

/**
 * Better to use ajv & `"$ts": "ObjectId"`
 * @example
 * ```typescript
 * async handler({id}) {
 *   id = objectId(id)
 * }
 * ```
 */
function reviveOid<T>(source: T) {
  return typeof source === "string" ? createFromHexString(source) as Oid<Extract<T, string>>
  : source as Exclude<T, ObjectId|string> | Ever<Extract<T, ObjectId>, Oid<Extract<T, string>>>
}

function reviveOids<S extends undefined|null|any[]>(
  sources: S,
  //@ts-ignore
  target: Array<ObjectId|Exclude<NonNullable<S>[number], ObjectId|string>> = sources
) {
  if (!sources)
    return sources as Extract<S, undefined|null>

  for (let s = sources.length; s-->0;)
    target[s] = reviveOid(sources[s])

  return target
}

const maxUpdatedAtOps = {
  "sort": {"updatedAt": -1},
  "limit": 1,
  "projection": {"_id": 0, "updatedAt": 1},
} as const
async function getMaxUpdated<T extends {"updatedAt"?: Date|number}>(collection: CollectionReadOnly<T>, $match: Filter<T> = {"updatedAt": {"$type": "date" as const}}) {
  const arr = await collection.find($match, maxUpdatedAtOps)
  .map(getUpdatedAt)
  .toArray()

  return arr[0]
}

function get_id<T extends {"_id"?: any}>(item: T) {
  return item._id
}

function getUpdatedAt<T extends {"updatedAt"?: any}>(item: T) {
  return item.updatedAt
}

