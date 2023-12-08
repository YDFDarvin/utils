import type {
  Collection,
  Db,
  MongoClientOptions
} from "mongodb";
import { MongoClient } from "mongodb";
import { $all } from "./async";
import type { IndexMap } from "./mongo-indexes";
import {
  indexesCheck
} from "./mongo-indexes";
import {
  schemaCheck
} from "./mongo-sync";
import { forIn } from "./object";
import type { JsonStrictSchema } from "./schema.types";
import "./set";
import type {
  Arg1,
  Arg2,
  DeepReadonly,
  Dict
} from "./ts-utils.types";

export {
  checkCollection,
  checkDb,
  checkDbs,
};
export type {
  DbDesc
};

type DbDesc = {
  "url": string
  "opts": MongoClientOptions
  "models": Arg1<typeof checkDb>
}

function checkDbs<Descs extends Dict<DbDesc>>(dbDesc: Descs, ac?: AbortSignal, opts?: Arg2<typeof checkDb>) {
  return $all(forIn(dbDesc, async desc => {
    const mongo = await new MongoClient(desc.url, desc.opts).connect()

    //@ts-ignore Some `@types/node` versions lost this notation
    ac?.addEventListener("abort", () => {
      console.log("aborting")
      return mongo.close()
    })

    const r = await checkDb(mongo.db(), desc.models, opts)
    .catch(e => e as Error)
    .finally(() => mongo.close())

    return r
  }))
}

function checkDb<Desc extends Dict<{"collection": string} & Arg1<typeof checkCollection>>>(
  db: Db,
  dbDesc: Desc,
  opts?: Arg2<typeof checkCollection>
) {
  return $all(forIn(dbDesc, desc => {
    const collection = db.collection(desc.collection)

    return checkCollection(collection, desc, opts).catch(e => e as Error)
  }))
}

async function checkCollection(
  collection: Collection,
  {jsonSchema, indexes}: Partial<{
    "jsonSchema": null|DeepReadonly<JsonStrictSchema>
    "indexes": IndexMap
  }>,
  {
    checkIndexes,
    checkSchema,
    indexParams,
    isSensitive
  }: Partial<{
    "checkIndexes": boolean
    "checkSchema": boolean
    "indexParams": Arg2<typeof indexesCheck>
    "isSensitive": Arg2<typeof schemaCheck>
  }> = {}
) {
  const [indexesStatus, schemaStatus] = await Promise.all([
    checkIndexes && indexes && indexesCheck(collection, indexes, indexParams),
    checkSchema && jsonSchema && schemaCheck(collection, jsonSchema, isSensitive),
  ]) 

  return {
    "collection": collection.collectionName,
    "jsonSchema": schemaStatus,
    "indexes": indexesStatus
  }
}
