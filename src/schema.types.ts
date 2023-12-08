import type { Dict, OneOf2, OrArray, Replace } from "./ts-utils.types"

/** @see https://www.mongodb.com/docs/manual/reference/bson-types/#bson-types */
export type bsonType = "double"|"string"|"object"|"array"|"binData"|"undefined"|"objectId"|"bool"|"date"|"null"|"regex"|"dbPointer"|"javascript"|"symbol"|"javascriptWithScope"|"int"|"timestamp"|"long"|"decimal"|"minKey"|"maxKey"

export type JsonStrictSchema = Partial<{
  /** @see https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/#available-keywords
   * > does not support the "integer" type. Use the bsonType keyword and the "int" or "long" types instead. */
  "type": OrArray<"null"|"boolean"|"integer"|"number"|"string"|"object"|"array">
  /** @see https://www.mongodb.com/docs/manual/reference/bson-types/#bson-types */
  "bsonType": bsonType|bsonType[]

  // explicit values
  "enum": unknown[]
  "const": unknown

  // number
  "multipleOf": number
  "maximum": number
  "minimum": number
  "exclusiveMaximum": number
  "exclusiveMinimum": number

  // string
  "maxLength": number
  "minLength": number
  "pattern": string|RegExp
  
  // object
  "required": string[]
  "properties": Dict<boolean|JsonStrictSchema>
  "additionalProperties": boolean|JsonStrictSchema
  "maxProperties": number
  "minProperties": number
  /** @deprecated No replacement in v4 */
  "propertyNames": never //JsonStrictSchema
  // TODO "dependencies":
  // TODO "definitions":

  // array
  "items": JsonStrictSchema|JsonStrictSchema[]
  "additionalItems": boolean|JsonStrictSchema
  "uniqueItems": boolean
  "contains": JsonStrictSchema

  // TODO logical
  "anyOf": JsonStrictSchema[]
  "oneOf": JsonStrictSchema[]
  "allOf": JsonStrictSchema[]
  "not": JsonStrictSchema
  /** @deprecated No replacement in v4 */
  "if": never //JsonStrictSchema
  /** @deprecated No replacement in v4 */
  "then": never //JsonStrictSchema
  /** @deprecated No replacement in v4 */
  "else": never //JsonStrictSchema
}>

export type MongoSchema = Replace<JsonStrictSchema, Partial<
  OneOf2<Pick<JsonStrictSchema, "type">, Pick<JsonStrictSchema, "bsonType">
  & {
    "exclusiveMaximum": boolean
    "exclusiveMinimum": boolean
  }>
>>
