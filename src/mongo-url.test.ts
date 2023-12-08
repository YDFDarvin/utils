import {
  mongoOpts,
  mongoParams,
  mongoUrl
} from "./mongo-url"

it(mongoParams.name, () => expect(mongoParams(
  //@ts-expect-error
  {}
)).toStrictEqual({
  "url": "mongodb://localhost",
  "opts": {"connectionName": undefined}
}))

it(mongoUrl.name, () => expect(mongoUrl({
  "protocol": "protocol",
  "user": "user",
  "pass": "pass",
  "host": "host",
  "port": "port",
  "dbName": "dbName",
  "authSource": "authSource"
})).toBe(
  "protocol://user:pass@host:port/dbName?authSource=authSource"
))

it(mongoParams.name, () => expect(mongoOpts({
  "connectionName": "c1",
  "pem": "./path",
  "allowInvalid": true
})).toStrictEqual({
  "connectionName": "c1",
  "ssl": true,
  "sslCA": "./path",
  "sslValidate": false,  
}))