import type { Schema } from "ajv";
import { config } from "dotenv";
import { existsSync } from "fs";
import { types } from "util";
import { validate, validatorWithCoerceTypes } from "./ajv";
import type { DeepReadonly, Schema2Ts } from "./ts-utils.types";

// Jest change `process.env` to be `Proxy`
if (types.isProxy(process.env))
  process.env = {...process.env}

declare global {

  namespace NodeJS {

    interface ProcessEnv {
      [k: string]: {["deprecated"]: never}
    }
  }
}

export {
  doEnv,
  assignEnv,
  validateEnv
};

function doEnv<S extends Exclude<Schema, boolean>>(envSchema: undefined|DeepReadonly<S>) {
  assignEnv()

  return envSchema ? validateEnv<S>(envSchema) : process.env as Schema2Ts<
    //@ts-expect-error
    S
  >
}

function assignEnv() {
  const appEnv = process.env.NODE_ENV || "development"
  , basePath = `${process.cwd()}/.env`
  /** @see https://create-react-app.dev/docs/adding-custom-environment-variables/#what-other-env-files-can-be-used */
  , paths = [
    `${basePath}.${appEnv}.local`,
    `${basePath}.${appEnv}`,
    `${basePath}.local`,
    basePath
  ]

  for (let p = 0; p < paths.length; p++) {
    const path = paths[p]
    if (!existsSync(path))
      continue

    config({path})
  }
}

function validateEnv<S extends Exclude<Schema, boolean>>(
  envSchema: DeepReadonly<S>,
  env = process.env as Record<string, unknown>
) {
  const clone = {...env}

  validate(
    envSchema,
    clone,
    {
      "dataVar": "env",
      // "separator": "\n -"
    },
    validatorWithCoerceTypes
  )

  //@ts-expect-error
  return clone as Schema2Ts<S>
}
