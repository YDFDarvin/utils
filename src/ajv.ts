import Ajv, { Options } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats";
import ajvInstanceOf from "ajv-keywords/dist/definitions/instanceof";
import ajvTransform from "ajv-keywords/dist/definitions/transform";
import type { CompileKeywordFunc } from "ajv/dist/types";
import type {
  Arg0,
  Arg1,
  DeepReadonly,
  Dict,
  JsonSchema,
  primitive,
  Schema2Ts
} from "./ts-utils.types";

export {
  ajvOpts, pushErrors, validate, validator,
  validatorWithCoerceTypes
};

const {assign: $assign} = Object
, {isArray: $isArray} = Array

const compile$ts: CompileKeywordFunc = (
  schema,
  {"type": parentType},
  schemaIt
) => {
  // TODO condider Array for Set
  if (parentType && !(
    $isArray(parentType)
    ? parentType.includes("object")
    : parentType === "object"
  ))
    return _ => true

  const constructor =
  schema === "Date" ? Date
  : schema === "ObjectId" ? require("mongodb").ObjectId
  : undefined

  if (!constructor)
    throw new Error(`$ts: unknown "${schema}"`)

  if (!schemaIt.opts.coerceTypes)
    return data => data instanceof constructor

  return (data, it) => {
    if (data instanceof constructor)
      return true
    
    //@ts-ignore
    const replacement = it.parentData[it.parentDataProperty] = new constructor(data)
  
    return replacement instanceof constructor 
  }
}

const ajvOpts: Options = {
  "inlineRefs": true,
  "verbose": true,
  "allErrors": true,
  "strict": true,
  "strictSchema": true,
  // "validateSchema": true,
  "strictRequired": false,
  "allowUnionTypes": true,
  "coerceTypes": false,
  "useDefaults": true,
  "formats": {
    ...fullFormats,
  },
  "keywords": [
    "bsonType",
    ajvInstanceOf(),
    //@ts-ignore
    ajvTransform(),
    {
      "keyword": "$ts",
      "schemaType": "string",
      "metaSchema": {
        "type": "string"
      },
      "modifying": true,
      "compile": compile$ts
    }
  ]
}
, validator = new Ajv(ajvOpts)
, validatorWithCoerceTypes = new Ajv({
  ...ajvOpts,
  "coerceTypes": true
})

function validate<Schema extends JsonSchema & Arg0<Ajv["validate"]>>(
  schema: DeepReadonly<Schema>,
  data: Arg1<Ajv["validate"]>,
  errorOpts: Arg1<Ajv["errorsText"]> = undefined,
  ajvInstance = validator
): data is Schema2Ts<Schema> {
  if (ajvInstance.validate(schema, data))
    return true

  const errors = ajvInstance.errors!

  for (let e = errors?.length; e-->0;) {
    const error = errors[e]
    delete error.parentSchema
    // delete error.schema
  }

  throw $assign(Error(ajvInstance.errorsText(errors, errorOpts)), {errors})
}

function pushErrors(
  store: Dict<Dict<{
    "ids": Set<string|number>
    "values"?: Set<primitive>
  }>>,
  errors: Array<{
    "schemaPath": string
    "message": string
    "params"?: Dict
    "data"?: unknown
  }>,
  id: string|number,
  isSensitive?: (probe: primitive) => boolean
) {
  const {length} = errors

  for (let e = 0; e < length; e++) {
    const {schemaPath, message, data, params} = errors[e]
    , path = schemaPath // TODO Consider ?.replace(/(\/)[0-9]+(\/|$)/g, "$1*$2")
    , schemaErr = store[path] ??= {}
    , errDetails = schemaErr[message!] ??= {} as typeof schemaErr[string]

    if (id !== undefined) {
      const ids = errDetails.ids = errDetails.ids ?? new Set()
      ids.add(id)
    }

    if (data !== undefined) {
      const values = errDetails.values = errDetails.values ?? new Set()
      , value = params?.additionalProperty as string
      ?? (
        data !== null && typeof data === "object" ? `[${data.constructor.name}]`
        : isSensitive?.(
          //@ts-expect-error Due to `unknown`
          data
        ) ? "<hidden>"
        : data
        
      )

      // TODO filter by some regex
      values.add(value as string)
    }
  }
}
