import type { Request } from "express"
import {
  validate,
  validatorWithCoerceTypes
} from "./ajv"
import { assignLogger } from "./logger"
import type {
  DeepReadonly,
  Dict,
  Ever,
  JsonSchema
} from "./ts-utils.types"

const {defineProperty: $defineProperty} = Object

export {
  makePayload
}

function makePayload<
  Schema extends DeepReadonly<JsonSchema>,
  Params extends never|Dict = never,
  Query extends never|Dict = never,
  Body extends never|Dict = never,
  E extends Dict = {}
>(
  schema: undefined|Schema,
  {body, params, query, user}: Request<Params, never, Body, Query, never> & {"user"?: unknown},
  etc?: E
) {
  const payload = {
    ...body,
    ...query,
    ...params,
    ...etc,
    //@ts-expect-error
    ...user && {"userId": user._id}
  } as E
  & Ever<Params, Params, {}>
  & Ever<Query, Query, {}>
  & Ever<Body, Body, {}>
  , {trace} = payload

  delete payload.trace

  if (user)
    $defineProperty(payload, "user", {
      "enumerable": false,
      "value": user
    })

    schema && validate(
    schema,
    payload,
    {"dataVar": "payload"},
    validatorWithCoerceTypes
  )

  payload.trace = trace

  return assignLogger(payload)
}
