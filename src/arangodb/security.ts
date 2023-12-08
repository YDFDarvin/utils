import { validate, validatorWithCoerceTypes } from "../ajv";
import querySchema from "./query.schema.json";
import type { ArangoBaseRepository, ISearch } from "./repository.arango";
import type { ArangoBaseDocument } from "./db.types";

const { isArray: $isArray } = Array

function validateQuery(
  schema: object,
  payload: object,
  payloadFieldName = "body"
) {
  try {
    validate(
      schema,
      payload,
      { dataVar: payloadFieldName },
      validatorWithCoerceTypes
    );
  } catch (e) {
    throw new Error("Query injection");
  }
}

export function PreventInjections() {
  return function (
    _target: ArangoBaseRepository<ArangoBaseDocument>,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    type Arg = ISearch<ArangoBaseDocument> | ISearch<ArangoBaseDocument>[]
    descriptor.value = function (...args: Arg[]) {
      args.forEach((a) => {
        if ($isArray(a))
          a.forEach((stage) => validateQuery(querySchema, stage))
        else validateQuery(querySchema, a)
      })
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}
