import { deepStrictEqual } from "assert"
import type {
  CreateCollectionOptions, Filter
} from "mongodb"
import { sortKeysAsc } from "./assoc"
import type { CollectionWriteable } from "./mongo-ops"
import type {
  JsonStrictSchema,
  MongoSchema
} from "./schema.types"
import type {
  DeepReadonly,
  Dict,
  Mutate,
  Replace
} from "./ts-utils.types"

export {
  cursorInvalid,
  equalSchemas,
  json2mongoSchema,
  setSchema
}

const {
  keys: $keys,
  assign: $assign,
} = Object
, {isArray: $isArray} = Array
, {
  min: $min,
  max: $max
} = Math
, schemaProps = new Set<string>([
  "additionalProperties",
  "additionalItems",
  "contains",
  "items",
  // No replacement in v4
  // "propertyNames",
  "not"
] as Array<keyof JsonStrictSchema>)
, schemaPropsNested = new Set<string>([
  "properties"
] as Array<keyof JsonStrictSchema>)
, schemaArrayProps = new Set<string>([
  "items",
  "allOf",
  "anyOf",
  "oneOf"
] as Array<keyof JsonStrictSchema>)
, schemaAllowed = new Set<string>([
  // https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/#available-keywords
  "additionalItems","additionalProperties","allOf","anyOf","bsonType","dependencies","description","enum","exclusiveMaximum","exclusiveMinimum","items","maximum","maxItems","maxLength","maxProperties","minimum","minItems","minLength","minProperties","multipleOf","not","oneOf","pattern","patternProperties","properties","required","title","type","uniqueItems",
  // TODO check https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/#omissions
  "$ref", "$schema", "default", "format", "id"
])

async function setSchema<I extends Dict>(
  collection: CollectionWriteable<I>,
  schema: null|undefined|DeepReadonly<JsonStrictSchema>,
  opts?: Replace<Pick<CreateCollectionOptions, "validationAction"|"validationLevel">, {
    /**
     * @see https://www.mongodb.com/docs/manual/reference/command/collMod/#mongodb-collflag-validationLevel
     * @default "strict"
    */
    "validationLevel"?: 
    /** No validation for inserts or updates. */
    |"off"
    /** Apply validation rules to inserts and to updates on existing valid documents. Do not apply rules to updates on existing invalid documents. */
    |"moderate"
    /** Apply validation rules to all inserts and all updates. */
    |"strict"
    /**
     * @see https://www.mongodb.com/docs/manual/reference/command/collMod/#mongodb-collflag-validationAction
     * @default "error"
    */
    "validationAction"?: "warn" | "error"
  }>
) {
  if (schema === undefined && opts === undefined)
    return undefined

  let validator = schema === undefined ? undefined
  : (await collection.options()).validator
  
  if (schema !== undefined) {
    if (schema === null)
      validator && delete validator.$jsonSchema
    else {
      !validator && (validator = {})

      validator.$jsonSchema = json2mongoSchema(schema)
    }      
  }

  return collection.s!.db.command({
    "collMod": collection.collectionName,
    ...validator && {validator},
    ...opts
  })
}

async function equalSchemas<I extends Dict>(
  collection: CollectionWriteable<I>,
  schema: DeepReadonly<JsonStrictSchema>,
) {
  const $jsonSchema = (await collection.options()).validator?.$jsonSchema
  
  if (!$jsonSchema)
    return null
  
  if (!schema)
    return undefined

  const mongoSchema = json2mongoSchema(schema)

  try {
    deepStrictEqual($jsonSchema, mongoSchema)
  } catch (e) {
    return e as Error
  }

  return true
}

async function cursorInvalid<I extends Dict>(
  collection: CollectionWriteable<I>,
  schema?: DeepReadonly<JsonStrictSchema>,
  match?: Filter<I>
) {
  const validator = schema
  ? {"$jsonSchema": json2mongoSchema(schema)}
  : (await collection.options()).validator as undefined | Filter<I>

  //@ts-ignore
  return validator && collection.find({
    ...match,
    "$nor": $keys(validator)
    //@ts-ignore
    .map((k: keyof typeof validator) => ({[k]: validator[k]}))
  })
}

/** @todo - inject `additionalProperties:false` + `_id:{...}`  */
function json2mongoSchema<S extends JsonStrictSchema>(jsonSchema: DeepReadonly<S>): MongoSchema {
  // TODO Consider
  // if (jsonSchema === true)
  //   return {}

  if (jsonSchema === null || Array.isArray(jsonSchema) || typeof jsonSchema !== "object")
    throw Error("JsonSchema should be object")

  const mongoSchema = $assign({}, jsonSchema) as unknown as Mutate<JsonStrictSchema, MongoSchema>

  /** @see https://www.mongodb.com/docs/mongodb-shell/reference/data-types/#int32
   * > If a number can be converted to a 32-bit integer, mongosh will store it as Int32. If not, mongosh defaults to storing the number as a Double
   * > Default Int32 and Double types may be stored inconsistently if you connect to the same collection using both mongosh and the legacy mongo shell.
   * */ 

  const {"type": jsonType} = jsonSchema
  if (mongoSchema.bsonType)
    delete mongoSchema.type
  else if (jsonType === "integer") {
    delete mongoSchema.type
    mongoSchema.bsonType = ["int", "double"]
    "multipleOf" in mongoSchema || (mongoSchema.multipleOf = 1)
  } else if ($isArray(jsonType) && jsonType.includes("integer")) {
    delete mongoSchema.type
    mongoSchema.bsonType = jsonType.map(t => t === "integer" ? ["int", "double"] : t).flat()
    "multipleOf" in mongoSchema || (mongoSchema.multipleOf = 1)
  }

  const {exclusiveMinimum} = jsonSchema 
  if (typeof exclusiveMinimum === "number") {
    const minimum = mongoSchema.minimum = $max(exclusiveMinimum, jsonSchema.minimum ?? exclusiveMinimum)
    
    delete mongoSchema.exclusiveMinimum
    minimum === exclusiveMinimum && (mongoSchema.exclusiveMinimum = true)
  }

  const {exclusiveMaximum} = jsonSchema 
  if (typeof exclusiveMaximum === "number") {
    const maximum = mongoSchema.maximum = $min(exclusiveMaximum, jsonSchema.maximum ?? exclusiveMaximum)
    
    delete mongoSchema.exclusiveMaximum
    maximum === exclusiveMaximum && (mongoSchema.exclusiveMaximum = true)
  }

  if ("const" in jsonSchema) {
    delete mongoSchema["const"]
    mongoSchema.enum = [jsonSchema.const]
  }

  for (const key in jsonSchema) {
    if (!schemaAllowed.has(key)) {
      //@ts-expect-error
      delete mongoSchema[key]
      continue
    }

    const value = jsonSchema[key]
    
    if (value === null || typeof value !== "object")
      continue

    switch (true) {
      case $isArray(value) && schemaArrayProps.has(key):
        //@ts-expect-error
        mongoSchema[key] = value.map(json2mongoSchema)
        break

      case schemaPropsNested.has(key):
        
        const v
        //@ts-expect-error
        = mongoSchema[key]
        = $assign({}, value)

        for (const k in value)
          //@ts-expect-error
          v[k] = json2mongoSchema(value[k])
        break

      case schemaProps.has(key):
        //@ts-expect-error
        mongoSchema[key] = json2mongoSchema(value)
        break
    }
  }

  return sortKeysAsc(mongoSchema)
}
