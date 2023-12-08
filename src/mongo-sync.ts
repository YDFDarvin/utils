import type { Db } from "mongodb";
import {
  pushErrors,
  validate
} from "./ajv";
import { isEmptyObject } from "./assoc";
import { $all } from "./async";
import type {
  IndexMap
} from "./mongo-indexes";
import {
  createIndexes,
  dropIndexes,
  hidingIndexes,
  indexesCheck,
  makeIndexActions
} from "./mongo-indexes";
import { CollectionWriteable, count } from "./mongo-ops";
import {
  cursorInvalid,
  equalSchemas,
  setSchema
} from "./mongo-schema";
import { forIn } from "./object";
import type { JsonStrictSchema } from "./schema.types";
import "./set";
import type {
  Arg0,
  Arg1,
  Arg2,
  Arg3,
  DeepReadonly,
  Dict,
  JsonSchema,
  primitive,
  Schema2Ts
} from "./ts-utils.types";

export {
  schemaCheck,
  sync4tests,
  syncCollectionIndexes,
  recreateCollection
};

async function syncCollectionIndexes<T extends Dict>(collection: CollectionWriteable<T>,
  {indexes}: Partial<{
    "indexes": IndexMap<T>
  }>,
  params: Partial<{
    "create": boolean
    "delete": boolean|"hide"
    "modify": boolean
    "rename": boolean
    "indexParams": Arg2<typeof indexesCheck>
  }>
) {
  if (!indexes)
    return indexes

  const {indexParams = {}} = params
  , actions = await indexesCheck(collection, indexes, indexParams)

  if (!actions?.ok)
    return actions

  const {
    create,
    del,
    hide,
    rename,
    unhide,
    change
  } = actions
  , unhiding = {
    ...unhide
  }
  , creating = {
    ...params.create && create,
    ...params.modify && change,
    ...params.rename && rename
  }
  , deleting = {
    ...params.delete === true && del,
    ...params.modify && change,
    ...params.rename && rename
  }
  , hiding = {
    ...hide,
    ...params.delete === "hide" && del
  }
  , {cd, ...etc} = await $all({
    "hid": isEmptyObject(hiding) ? undefined : hidingIndexes(collection, hiding, true),
    "unhid": isEmptyObject(unhiding) ? undefined : hidingIndexes(collection, unhiding, false),
    "cd": (async () => {
      const deleted = await dropIndexes(collection, deleting)
      , created = await createIndexes(collection, creating)

      return {deleted, created}
    })()
  })

  return {
    "ok": 1,
    ...etc,
    ...cd
  }
}

// TODO Consider `cursorInvalid(_id: {gt: invalidIdExample})`
async function schemaCheck<I extends Dict>(
  collection: CollectionWriteable<I>,
  schema?: DeepReadonly<JsonStrictSchema>,
  isSensitive?: Arg3<typeof pushErrors>
) {
  const errors: Dict<Dict<{
    "ids": Set<string>
    "values"?: Set<primitive>
  }>> = {}

  let invalidCount = 0

  const {totalCount, equality} = await $all({
    "totalCount": count(collection),
    "equality": schema && equalSchemas(collection, schema),
    "_erroring": schema && (await cursorInvalid(collection, schema))?.forEach(invalid => {
      invalidCount++

      const id = `${invalid._id}`

      try {
        validate(schema, invalid)
        /* istanbul ignore next */
        pushErrors(errors, [{
          "message": "mongo level - TODO enrich jsonSchema",
          "schemaPath": "mongo"
        }], id, isSensitive)
      } catch (e: any) {
        /* istanbul ignore next */
        pushErrors(errors, e.errors ?? [{
          "schemaPath": e.name,
          "message": e.message,
          "data": e,
        }], id, isSensitive)
      }
       
      return true
    })
  })
  
  return {
    "ok": !invalidCount,
    equality,
    totalCount,
    invalidCount,
    errors
  }
}

function sync4tests<M extends Dict<{
  "collection": string
} & Partial<{
  "indexes": Arg0<typeof makeIndexActions>
  "jsonSchema": Arg1<typeof setSchema>
}>>>(db: Db, models: M): Promise<{
  [m in keyof M]: CollectionWriteable<
    //@ts-expect-error
    M[m] extends {"jsonSchema": JsonSchema} ? Schema2Ts<M[m]["jsonSchema"]> : Dict
  >
}> {
  //@ts-expect-error
  return $all(forIn(models, async ({collection, indexes, jsonSchema}) => {
    const c = await recreateCollection(db, collection)
    .catch(
      /* istanbul ignore next: in case of permissions*/
      () => db.collection(collection)
    )

    await $all({
      "indexes": indexes && createIndexes(c, makeIndexActions(
        indexes,
        {},
        {
          "experimental": true
        }
      ).create!),
      "jsonSchema": setSchema(c, jsonSchema)
    })

    return c
  }))
}

async function recreateCollection<T extends Dict>(db: Db, name: string) {
  ;(await db.listCollections({name}).toArray())[0]
  && await db.dropCollection(name)

  return await db.createCollection<T>(name)
}
