import type { MongoClientOptions } from "mongodb"
import type {
  Arg0, Part
} from "./ts-utils.types"
import { urlBuild } from "./url"

export {
  mongoParams,
  mongoUrl,
  mongoOpts,
}

function mongoParams(params: Arg0<typeof mongoUrl> & Arg0<typeof mongoOpts>) {
  const opts: {
    "url": string
    "opts": MongoClientOptions & Part<{
      "connectionName": string
    }>
  } = {
    "url": mongoUrl(params),
    "opts": mongoOpts(params)
  }

  return opts
}

function mongoUrl({
  protocol,
  user,
  pass,
  host,
  port,
  dbName,
  authSource,
}: {
  "host": string
  "dbName": string
  "authSource"?: string
} & Part<{
  "protocol": string
  "port": string|number
  "user": string
  "pass": string
}>) {
  return urlBuild({
    "protocol": protocol || "mongodb",
    user,
    pass,
    host,
    port,
    "path": dbName,
    "search": !authSource ? undefined : {authSource}
  })
}

function mongoOpts({
  connectionName,
  pem,
  allowInvalid,
  ...mongoOptions
}: Part<{
  "connectionName": string
  "pem": string,
  "allowInvalid": string|boolean
}> & Omit<MongoClientOptions,
  |"connectionName"
  |"ssl"
  |"sslCA"
  |"sslValidate"
>) {
  const {
    protocol,
    user,
    pass,
    host,
    port,
    dbName,
    authSource,
    ...op
  } = mongoOptions as typeof mongoOptions & Arg0<typeof mongoUrl>
  //@ts-ignore Mongo3 compatibility: Types of property 'sslCA' are incompatible.  Type 'string | undefined' is not assignable to type 'readonly (string | Buffer)[] | undefined
  const opts: MongoClientOptions & Part<{
    "connectionName": string
  }> = {
    connectionName,
    ...op,
    ...pem && {
      "ssl": true,
      "sslCA": pem,
      "sslValidate": !(`${allowInvalid}` === "true")
    }
  }

  return opts
}

