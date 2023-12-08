/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */
import type {
  Collection,
  DeleteResult,
  Filter,
  MatchKeysAndValues,
  ModifyResult,
  ObjectId,
  UpdateFilter,
  UpdateOneModel,
  UpdateResult
} from "mongodb";
import {
  bulkWrite,
  bulkWriteOpts,
  CollectionWriteable,
  findOneAndUpdate,
  updatedAt_OLD,
  updateMany
} from "../mongo-ops";
import type {
  AnyObject,
  Arg1,
  Dict,
  EmptyObject,
  Id,
  Project,
  Projection,
  Promisable,
  Replace
} from "../ts-utils.types";

export type StatusId = typeof statuses[keyof typeof statuses] 

type Statused<T = EmptyObject, Sign = string> = T & {
  "_id": ObjectId
  "status": StatusId
  "updatedAt": Date
  "retries"?: number
  /** WorkerId @todo `Partial` */
  // CONSIDER ObjectId
  "wid"?: Sign
  /** JobId @todo `Partial` */
  "jid"?: Sign
  "e"?: {
    "message": string
  }
}

export type RetryParams = {
  "timeout": number
  "max": number
  "limit"?: number
}

const {assign: $assign} = Object
, STATUS_FATAL = -2 as Id<"status", -2>
, STATUS_ERROR = -1 as Id<"status", -1>
, STATUS_NEW = 0 as Id<"status", 0>
, STATUS_DONE = 1 as Id<"status", 1>
, STATUS_PENDING = 2 as Id<"status", 2>
, statuses = {
  STATUS_NEW,
  STATUS_PENDING,
  STATUS_DONE,
  STATUS_ERROR,
  STATUS_FATAL
}
, statusNotPending = {"$ne": STATUS_PENDING}
, /** Doesn't work inside `$setOnInsert`*/
  setUpdatedAt = {"updatedAt": "$$NOW"} as const
, statusSetPending = {
  ...updatedAt_OLD,
  "$set": { "status": STATUS_PENDING }
}
, finishOpts = {"force": false, "projection": false}
, idOnlyParams = {"projection": {"_id": 1}} as const

export type {
  Statused
};
export {
  add,
  finish,
  remove,
  take,
  signMany,
  bulkRun,
  retry,
  keep,
  getAndUpdateAbandoned,
  redo,
  findFutureTask,
  freshnessFilter,
  STATUS_FATAL,
  STATUS_ERROR,
  STATUS_NEW,
  STATUS_DONE,
  STATUS_PENDING,
  statuses,
  setUpdatedAt,
  updatedAt_OLD
};

async function add<T extends AnyObject, C extends Statused<T>, WithId extends boolean>(
  _collection: CollectionWriteable<C>,
  {immediate, id}: {
    "immediate": boolean
    "id": WithId
  },
  tasks: (T | null)[],
  metas?: Partial<Exclude<C, keyof Statused<T>>>[]
) {
  type UpdateNowTrick = C & {"_u": string}

  const bulk: {"updateOne": UpdateOneModel<T & UpdateNowTrick>}[] = []
  , collection = _collection as unknown as Collection<C & UpdateNowTrick>
  , {length} = tasks
  , nextStatus = immediate ? STATUS_PENDING : STATUS_NEW

  for (let i = 0; i < length; i++) {
    const task = tasks[i]
    , meta = metas?.[i]

    bulk.push({"updateOne": {
        "filter": task
        // Find with empty result. Another option is `{"_id": null}`
        || {"status": null as any},
        //@ts-ignore
        "update": {
          //@ts-ignore
          "$setOnInsert": {
            ...task,
            "status": nextStatus,
            "_u": "$$NOW"
          },
          ...meta && {"$set": meta}
        },
        "upsert": true,
      }}
    )
  }

  if (bulk.length === 0)
    return null

  const r = await bulkWrite(
    //@ts-expect-error Types of property 'updateOne' are incompatible. Types of parameters 'filter' and 'filter' are incompatible.
    collection,
    bulk,
    bulkWriteOpts
  )
  // DUMB @types/mongo
  , upserted = (r as unknown as {
    getUpsertedIds(): AnyObject[]
  }).getUpsertedIds()

  await updateMany(collection,
    {"_u": "$$NOW"} as Filter<C & UpdateNowTrick>,
    [
      {"$set": setUpdatedAt},
      {"$unset": ["_u"]}
    ]
  )

  if (!upserted.length)
    return null

  for (let c = upserted.length; c-->0;) {
    const created = upserted[c]
    , {index} = created

    delete created.index
    id || delete created._id
    $assign(created, tasks[index], metas?.[index])
  }

  return upserted as Array<
    WithId extends false ? T
    : T & {"_id": ObjectId}
  >
}

type FinishPayload<T, R> = {
  "ok": true
  "task": T
  "result": R
} | {
  "ok": false
  "task": T
  "result": Dict
}

async function finish<
  T,
  C extends Statused<T>,
  R extends undefined|Partial<Omit<C, keyof (Statused<T> & T)>>
>(
  collection: CollectionWriteable<C>,
  {
    force,
    projection
  }: {
    "force": boolean
    "projection": boolean | {}
  },
  {
    task,
    result,
    ok
  }: FinishPayload<T, R>) {

  const r = await (findOneAndUpdate(collection,
    {
      ...task,
      ...!force && {
        "status": STATUS_PENDING,
      }
    } as unknown as Filter<C>,
    [
      {
        "$set": {
          ...result,
          "status": ok ? STATUS_DONE : STATUS_ERROR,
          "updatedAt": !ok || force ? "$$NOW" : {
            "$cond": {
              "if": result,
              "then": "$updatedAt",
              "else": "$$NOW"
            }
          }
        }
      }
    ],
    {
      "returnDocument": projection === false ? undefined! : "after",
      "projection": projection === true ? undefined!
      : projection === false ? {_id: 0, "_": 1}
      : projection,
      "upsert": force
    }
  ) as unknown as Promise<ModifyResult<C>>)
  .catch(
    /* istanbul ignore next */
    e => e.codeName === "DuplicateKey"
    ? null
    : Promise.reject(e)
  )

  // TODO Consider `Error` instead of `null`
  return r
}

async function remove<T, C extends Statused<T>>(
  collection: Pick<Collection<C>, "deleteMany">,
  {force}: {
    "force": boolean
  },
  tasks: T[]
) {
  // @ts-expect-error
  const {deletedCount}: DeleteResult = await collection.deleteMany({
    "$or": tasks,
    ...!force && {"status": statusNotPending}
  }, {
    "ordered": false,
  })

  return deletedCount
}

type TakeParams<C> = {//TakeParams<C, Statused<C>>
  "match": undefined|Filter<C>
  "limit": number
  "projection": boolean | Project<C>
}

async function take<C>(
  collection: CollectionWriteable<Statused<C>>,
  {limit, projection, match}: TakeParams<C>
) {
  const freeTask = {
    ...match,
    "status": STATUS_NEW
  } as Filter<Statused<C>>
  , $project = projection === true ? {"status": 0}
  : projection === false ? {"_": 1}
  : projection
  , taken: Statused<C>[] = []

  let takenLength = 0

  while (takenLength < limit) {
    const {"value": took} = (await collection.findOneAndUpdate(
      freeTask,
      statusSetPending as unknown as UpdateFilter<Statused<C>>,
      {
        "projection": $project,
        "returnDocument": "after"
      }
    // DUMB @types/mongo
    ) as unknown as ModifyResult<Statused<C>> )!

    if (!took)
      break

    takenLength = taken.push(
      //@ts-ignore Argument of type 'WithId<Statused<C, string>>' is not assignable to parameter of type 'Statused<C, string>'
      took
    )
  }

  return takenLength === 0 ? null : taken
}

async function signMany<C, S, Sh extends Statused<C, S>>(
  collection: CollectionWriteable<Sh>,
  {match, jid, force}: {
    "jid": S
    "match": undefined|Filter<C>
    "force"?: boolean
  }
) {
  const matchTasks = force ? match: {
    ...match,
    "status": STATUS_NEW
  } as Filter<Sh>
  , nextStatus = {
    ...updatedAt_OLD,
    "$set": {
      "status": STATUS_PENDING,
      jid
    }
  } as unknown as UpdateFilter<Sh>
  , {modifiedCount} = await updateMany(
    //@ts-expect-error Type 'OptionalId<Document>' is not assignable to type 'OptionalId<Sh>' - maybe `C extends Document` will fix
    collection,
    matchTasks,
    nextStatus,
    {}
  ) as UpdateResult

  return modifiedCount
}

async function bulkRun<
  T,
  R extends Partial<Omit<C, keyof (Statused & T)>>,
  C extends Statused<T & R>
>(
  collection: CollectionWriteable<C>,
  params: Replace<TakeParams<C>, {
    "projection": {"_id"?: 0} & Record<Exclude<keyof T, "_id">, 1>
  }>,
  run: (task: T) => Promisable<R>,
) {
  type FP = FinishPayload<T, R>

  const taken = await take<C>(
    //@ts-ignore weird ts
    collection,
    params
  )

  if (taken === null)
    return null

  const promises = taken as unknown as Promise<FP>[]

  for (let t = taken.length; t-->0;) {
    const task = taken[t] as T
    promises[t] = (async () => {
      let payload: FP

      try {
        payload = {
          "ok": true,
          task,
          "result": await run(task as T)
        }
      } catch (e) {
        payload  = {
          "ok": false,
          task,
          "result": {"e": {
            //@ts-ignore
            "message": e.message,
            //@ts-ignore
            ...e
          }}
        }
      }

      await finish(collection,
        finishOpts,
        payload
      )

      return payload
    })()
  }

  return await Promise.all(promises)
}

const redoSet = [{
  "$set": {
    ...setUpdatedAt,
    "status": STATUS_NEW,
    "retries": 0
  }
}]

async function redo<T>(
  collection: CollectionWriteable<Statused<T>>,
  $match: Filter<T>,
  {force, reset}: Partial<{
    "force": boolean
    "reset": boolean
  }> = {}
) {
  const match = $match as Filter<Statused<T>>
  , {modifiedCount} = await updateMany<Statused<T>>(collection,
    force ? match
    : {
      ...match,
      "status": reset
      // Consider {"$ne": STATUS_PENDING}
      ? {"$in": [
        STATUS_FATAL,
        STATUS_ERROR,
        STATUS_NEW,
        STATUS_DONE,
      ]}
      : STATUS_DONE,
    },
    redoSet
  )

  return modifiedCount
}

const retryStatuses = {"$in": [STATUS_ERROR, STATUS_PENDING]} as const
, retrySet = {
  ...setUpdatedAt,
  "retries": {"$sum": ["$retries", 1]},
  "status": STATUS_NEW,
  "e": {
    "$cond": {
      "if": {"$eq": ["$status", STATUS_PENDING]},
      "then": {"message": "Staled"},
      "else": "$e"
    }
  }
}
async function retry<T>(
  collection: CollectionWriteable<Statused<T>>,
  params: RetryParams,
  $setRetry: undefined|MatchKeysAndValues<T>,
  $setFatal: undefined|MatchKeysAndValues<T>
) {
  const {"modifiedCount": fataled} = await updateMany(collection,
    //@ts-expect-error
    {
      ...retriesFilter(false, params),
      "status": retryStatuses,
    },
    [{
      "$set": {
        ...$setFatal,
        ...setUpdatedAt,
        "status": STATUS_FATAL,
      }
    }, {
      "$unset": "_u"
    }]
  ) as UpdateResult
  , {"modifiedCount": retried} = await updateMany(collection,
    //@ts-expect-error
    {
      ...retriesFilter(true, params),
      ...freshnessFilter(false, params),
      "status": retryStatuses,
    },
    [{"$set": {
      ...retrySet,
      ...$setRetry    
    }}, {
      "$unset": "_u"
    }]
  ) as UpdateResult

  return {retried, fataled}
}

function keep<S extends Statused>(
  collection: CollectionWriteable<S>,
  {timeout}: {
    "timeout": number
  },
  match: Pick<Statused, "jid">
) {
  const interval = timeout / 2
  , filter: Filter<Statused> = {
    ...match,
    "status": STATUS_PENDING
  } as Filter<Statused>
  , intervalId = setInterval(async () => {
    const {modifiedCount} = await updateMany<S>(collection,
      //@ts-ignore
      filter,
      //@ts-ignore
      updatedAt_OLD as UpdateFilter<Statused>
    )

    !modifiedCount && clearInterval(intervalId)
  }, interval)

  return () => clearInterval(intervalId)
}

async function* getAndUpdateAbandoned<S extends Statused, K extends Extract<keyof S, string>>(
  collection: CollectionWriteable<S>,
  params: Arg1<typeof freshnessFilter> & {
    "projection": {[k in K]?: 0|1}
    "match": undefined | Filter<S>
    "jid": string
    "limit": number
  }
) {
  const {
    match,
    jid,
    projection,
  } = params
  , freshness = freshnessFilter(false, params)
  , select = {
    ...match,
    ...freshness,
    "status": STATUS_NEW,
  } as Filter<S>
  , update = [{
    "$unset": "_u"
  }, {
    "$set": {
      ...setUpdatedAt,
      jid
    }
  }]
  , queryOpts = {projection} as const

  let {limit} = params
  , item: null|Projection<S, typeof queryOpts["projection"]> = null

  while (
    limit > 0
    && (item = await collection.findOne(select, queryOpts) as Projection<S, typeof queryOpts["projection"]>)
  ) {
    const {modifiedCount} = await updateMany(collection,
      {
        ...match,
        ...item,
        ...freshness,
        "status": STATUS_NEW,
      } as Filter<S>,
      update
    )
    if (!modifiedCount)
      continue
  
    limit--
    yield item
  }
}

function findFutureTask<T>(
  collection: CollectionWriteable<Statused<T>>,
  params: RetryParams,
  $match: Filter<Statused<T>>
) {
  return collection.findOne(
    {
      ...$match,
      "status": {"$ne": STATUS_DONE},
      "$or": [
        {"status": STATUS_NEW},
        retriesFilter(true, params),
        freshnessFilter(true, params)
      ],
    } as Filter<Statused<T>>,
    idOnlyParams
  )
}

function freshnessFilter(isFresh: boolean, {timeout}: {
  "timeout": number
}) {
  return {
    "$expr": {
      [isFresh ? "$gt" : "$lte"]: [
        "$updatedAt",
        {"$dateSubtract": {
          "startDate": "$$NOW",
          "amount": timeout,
          "unit": "millisecond"
        }}
      ]
    }
  }
}

function retriesFilter(able: boolean, {max}: {
  "max": number
}) {
  return {
    "retries": able
    ? {"$not": {"$gte": max}}
    : {"$gte": max}
  }
}
