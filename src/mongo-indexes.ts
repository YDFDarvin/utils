import type {
  CreateIndexesOptions,
  Db,
  IndexDescription,
  IndexDirection
} from "mongodb";
import {
  deleteUndefined,
  isEmptyObject,
  sortKeysAsc
} from "./assoc";
import { $all } from "./async";
import {
  CollectionReadOnly,
  CollectionWriteable,
  getDuplicatesCount
} from "./mongo-ops";
import {
  forIn,
  pick,
  project
} from "./object";
import type {
  Arg2,
  Dict,
  Mutate,
  Replace,
  Return
} from "./ts-utils.types";

export {
  aggregateIndexes,
  createIndexes,
  dropIndexes,
  hidingIndex,
  hidingIndexes,
  indexesCheck,
  makeIndexActions,
  normalizeIndexData
};
export type {
  IndexData,
  IndexMap
};
type IndexMap<Item = Dict> = Dict<IndexData<Item>>
type IndexData<Item = Dict> = Omit<IndexInfo<Item>, "v"|"name">
type IndexData2 = IndexData & {
  "_k": string
  "name"?: string
}
type IndexInfo<Item = Dict> = Replace<IndexDescription, {
  "key": {
    [k in keyof Item]?: string|number //-1|1|"text"
  }
}> & {
  "v": number
  "name": string
  "$comment"?: string
  "deprecated"?: boolean
  "experimental"?: boolean
}

const {
  entries: $entries,
  keys: $keys,
  values: $values,
  defineProperty: $defineProperty,
  assign: $assign
} = Object
, {isArray: $isArray} = Array

function makeIndexActions(source: IndexMap, target: IndexMap, {
  experimental,
  deprecated,
  unique,
  "hide": hideNotDelete
} = {} as Partial<{
  "experimental": boolean|"hide"
  "deprecated": boolean|"hide"
  "unique": boolean
  "hide": boolean
}>) {
  type Item = Return<typeof normalizeIndexData>

  const sourceMap: IndexMap = {}
  , targetMap : IndexMap = {}
  , create: Record<string, Item> = {}
  , del: Record<string, Item> = {}
  , rename: Record<string, Item> = {}
  , change: Record<string, Item & {"_was": Item}> = {}
  , hide: Record<string, Item> = {}
  , unhide: Record<string, Item> = {}
  , duplicates: Record<string, Item[]> = {}

  forIn(source, (v, name) => {
    const indexData = normalizeIndexData({...v, name})

    if (unique !== undefined && unique !== (indexData.unique ?? false))
      return

    if (!experimental && indexData.experimental)
      return

    const {_k} = indexData

    if (_k in duplicates) {
      // $defineProperty(indexData, "name", {
      //   "configurable": true,
      //   "enumerable": true,
      //   "value": indexData.name
      // })

      delete sourceMap[_k]
      duplicates[_k].push(indexData)
      return
    }

    if (_k in sourceMap) {
      const sourceItem = sourceMap[_k]
      delete sourceMap[_k]

      // $defineProperty(sourceItem, "name", {
      //   "configurable": true,
      //   "enumerable": true,
      //   //@ts-expect-error
      //   "value": sourceItem.name
      // })

      // $defineProperty(indexData, "name", {
      //   "configurable": true,
      //   "enumerable": true,
      //   "value": indexData.name
      // })

      duplicates[_k] = [
        //@ts-expect-error
        sourceItem,
        indexData
      ]

      return
    }

    // TODO error if already exists
    sourceMap[_k] = indexData

    return indexData
  })

  const targetNormalized = forIn(target, (v, name) => {
    const indexData = normalizeIndexData({...v, name})

    if (unique !== undefined && unique !== (indexData.unique ?? false))
      return

    const {_k} = indexData

    targetMap[_k] = indexData

    return indexData
  })

  for (const key in sourceMap) {
    const sourceItem = sourceMap[key]
    //@ts-expect-error
    , { name, _k } = sourceItem

    let targetItem = targetMap[key]

    if (!targetItem) {
      //@ts-expect-error
      targetItem = targetNormalized[name]

      if (!targetItem) {
        if (sourceItem.deprecated) {}
        else {
          if (experimental === "hide" && sourceItem.experimental)
            sourceItem.hidden = true
          //@ts-expect-error
          create[name] = sourceItem
        }
      } else {
        delete targetNormalized[name]

        //@ts-expect-error
        sourceItem._was = targetItem

        //@ts-expect-error
        change[name] = sourceItem
      }

      continue
    }

    //@ts-expect-error
    const {"name": targetName} = targetItem

    delete targetNormalized[targetName]

    if (name !== targetName) {
      // $defineProperty(sourceItem, "name", {
      //   "enumerable": true,
      //   "value": name
      // })
      //@ts-expect-error
      rename[targetName] = sourceItem
      continue
    }

    if (!sourceItem.experimental && !sourceItem.deprecated && targetItem.hidden)
      //@ts-expect-error
      unhide[name] = sourceItem
    else if (experimental === "hide" && sourceItem.experimental && !targetItem.hidden)
      //@ts-expect-error
      hide[name] = sourceItem
    else if (sourceItem.deprecated) {
      if (!deprecated)
        //@ts-expect-error
        del[name] = sourceItem
      else if (deprecated === "hide" && !targetItem.hidden)
        //@ts-expect-error
        hide[name] = sourceItem
    }
  }

  if (!hideNotDelete)
    $assign(del, targetNormalized)
  else
    for (const targetName in targetNormalized) {
      const targetItem = targetNormalized[targetName]!

      if (!targetItem.hidden)
        hide[targetName] = targetItem
    }

  const duplicatesArr = isEmptyObject(duplicates) ? undefined
  : $values(duplicates)
  , result = {
    create,
    del,
    rename,
    change,
    unhide,
    hide,
    "duplicates": duplicatesArr
  }

  return forIn({
    create,
    del,
    rename,
    change,
    unhide,
    hide,
    "duplicates": duplicatesArr
  }, v => !v || isEmptyObject(v) ? undefined : (
    $isArray(v) ? v : sortKeysAsc(v)
  )) as Partial<typeof result>
}

function normalizeIndexData<I extends Partial<IndexInfo>>(indexData: I) {
  const normalized = indexData as Mutate<I, IndexData2>

  delete normalized.v
  delete normalized.$comment
  delete normalized.background

  for (const key in indexData)
    //@ts-ignore
    if (indexData[key] === false)
      //@ts-ignore Backward compatibility with mongodb@^3
      delete normalized[key]

  const sorted = sortKeysAsc(normalized) as IndexData2

  $defineProperty(sorted, "_k", {
    "enumerable": false,
    "configurable": true,
    "value": indexIdentifier(sorted)
  })

  return sorted
}

const validIndexProps: Record<
Exclude<keyof IndexDescription, "version">,
  1
> = {
  "2dsphereIndexVersion": 1,
  "background": 1,
  "bits": 1,
  "bucketSize": 1,
  "collation": 1,
  "default_language": 1,
  "expireAfterSeconds": 1,
  "hidden": 1,
  "key": 1,
  "language_override": 1,
  "max": 1,
  "min": 1,
  "name": 1,
  "partialFilterExpression": 1,
  "sparse": 1,
  "storageEngine": 1,
  "textIndexVersion": 1,
  "unique": 1,
  // "version": 1,
  "weights": 1,
  "wildcardProjection": 1
}
, validIndexPropsArr = $keys(validIndexProps) as Array<keyof typeof validIndexProps>
// Consider: MongoServerError: Index already exists with a different name: _u-1
async function createIndexes<T extends Dict>(collection: CollectionWriteable<T>, indexesMap: IndexMap) {    
  const entries = $entries(indexesMap)

  if (entries.length === 0)
    return null

  return await collection.createIndexes(
    entries.map(([name, data]) => {
      const indexData = pick(
        {name, ...data as Replace<typeof data, {
          "key": Dict<IndexDirection>
        }>},
        validIndexPropsArr
      )
      
      return indexData
    },
    {
      "comment": createIndexes.name,
    } as CreateIndexesOptions)
  )
}

function hidingIndexes<T extends Dict>(collection: CollectionWriteable<T>, indexesMap: IndexMap, hidden: boolean) {
  const entries = $entries(indexesMap)
  // TODO Consider allSettled
  return entries.length === 0 ? null
  : Promise.all(entries.map(([n, data]) => {
    //@ts-expect-error
    const name: string = data.name || n,

    return hidingIndex(collection, name, hidden)
    .then(r => r.ok && name)
  }))
  .then(arr => arr.sort())
}

function hidingIndex<T extends Dict>(collection: CollectionWriteable<T>, name: string, hidden: boolean): Promise<{
  "ok": 1
  "hidden_new": boolean
  "hidden_old": boolean
}> {
  //@ts-expect-error
  return (collection.s.db as Db).command({
    "collMod": collection.collectionName,
    "index": {name, hidden}
  })
}

async function dropIndexes<T extends Dict>(collection: CollectionWriteable<T>, indexesMap: IndexMap) {
  return isEmptyObject(indexesMap) ? null
  : await $all(forIn(indexesMap, async (indexData, indexName) => {
    try {
      const r = await collection.dropIndex(indexName, {"comment": dropIndexes.name})
      /* istanbul ignore next: Just some general possibility of `ok !== 1` */
      return r.ok ? indexData : r
    } catch(e) {
      return e as Error
    }
  }))
}

const project2identifier = {
  "deprecated": 0,
  "experimental": 0,
  "hidden": 0,
  "name": 0,
  "usage": 0,
  "key": 0,
} as const
function indexIdentifier<I extends Pick<IndexData, "key"|"unique">>(indexData: I) {
  const forIndex = pick(indexData,
    //@ts-expect-error
    validIndexPropsArr
  )
  , {key, unique} = forIndex

  project(forIndex, project2identifier)

  return `${
    !unique ? ""
    : "un,"
  }${
    $entries(key)
    .map(([prop, value]) => `${prop}${value}`)
    .join(",")
  }${
    isEmptyObject(forIndex) ? ""
    : `=$${JSON.stringify(forIndex)}`
  }`
}

async function aggregateIndexes<T extends Dict>(collection: CollectionReadOnly<T>, ...pipeline: Dict[]) {
  const {"collectionName": name} = collection
  //@ts-expect-error
  , db: Db = collection.s.db
  , exists = await db.listCollections({name}).toArray()

  if (!exists.length)
    throw Error(`Collection '${db.databaseName}.${name}' doesn't exist`)

  return collection.aggregate([
    {"$indexStats": {}},
    {"$addFields": {
      "spec.usage": "$accesses"
    }},
    {"$addFields": {
      "spec.usage.building": "$building"
    }},
    {"$replaceRoot": {"newRoot": "$spec"}},
    ...pipeline
  ])
  .toArray()
  .catch(
    /* istanbul ignore next: Fallback for lack of permissions */
    () => collection.indexes({"full": true})
  )
}

async function indexesCheck<I extends Dict>(collection: CollectionWriteable<I>, indexes: IndexMap,
  params?: NonNullable<Arg2<typeof makeIndexActions>> & Partial<{
    "duplicates": number|boolean
  }>
) {
  const actions = makeIndexActions(
    indexes,
    (await aggregateIndexes(collection)).reduce((acc, item) => (
      acc[item.name] = item,
      acc
    ), {}),
    params
  )
  , createUniques = forIn(actions.create, v => v.unique ? v : undefined)
  const duplicates = params?.duplicates

  let duplicatedCounts: undefined | null | Dict<undefined | Return<typeof getDuplicatesCount>> = undefined
  , duplicatesError = undefined

  if (duplicates && createUniques) {
    duplicatedCounts = deleteUndefined(await $all(forIn(createUniques, indexData =>
      getDuplicatesCount<I>(
        collection,
        //@ts-expect-error
        indexData.key,
        //@ts-expect-error
        indexData?.partialFilterExpression,
        typeof duplicates !== "number" ? undefined : duplicates
      )
      .then(r => r || undefined)
      .catch(
        /* istanbul ignore next: Just in case */
        err => void (duplicatesError = err)
      )
    )))

    if (isEmptyObject(duplicatedCounts))
      duplicatedCounts = undefined
  }

  return {
    "ok": !duplicatedCounts && !actions.duplicates?.length,
    ...actions,
    duplicatedCounts,
    duplicatesError
  }
}