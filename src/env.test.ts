import {
  existsSync,
  unlinkSync,
  writeFileSync
} from "fs"
import {
  assignEnv,
  doEnv,
  validateEnv
} from "./env"
import type { Schema2Ts } from "./ts-utils.types"
import envSchema = require("../env.schema.json")

const env = process.env as unknown as Schema2Ts<typeof envSchema>
//@ts-expect-error
, curEnv = env.NODE_ENV

describe(validateEnv.name, () => {
  it("bad env", () => expect(() => validateEnv(
    envSchema,
    {
      TEST_DB: "1",
    }
  )).toThrowError())

  it("type coerce", () => {
    //@ts-ignore
    env.port = "3000"

    expect(
      //@ts-ignore
      validateEnv({
        "type": "object",
        "properties": {
          "port": {"type": "integer"}
        }
      }, env)
      //@ts-expect-error
      .port
    ).toBe(
      3000
    )
  })
})

describe(assignEnv.name, () => {
  const appEnv = "temp"
  , varName = "ENV_CHECK"
  , varValue = "1"
  , envPath = `${process.cwd()}/.env.${appEnv}.local`

  beforeAll(() => {
    writeFileSync(envPath, `${varName}=${varValue}`)
    //@ts-expect-error
    process.env.NODE_ENV = appEnv
  })
  afterAll(() => {
    unlinkSync(envPath)
    process.env.NODE_ENV = curEnv
    delete process.env[varName]
  })

  it("run", () => {
    expect(process.env[varName]).toBeUndefined()
    assignEnv()
    expect(process.env[varName]).toBe(varValue)
  })
})

describe(doEnv.name, () => {
  beforeAll(() => {
    delete process.env.NODE_ENV
  })
  afterAll(() => {
    process.env.NODE_ENV = curEnv
  })

  it("Check for empty NODE_ENV and no env files", () => {
    const basePath = `${process.cwd()}/.env`

    expect(
      [
        basePath,
        `${basePath}.development`,
        `${basePath}.development.local`
      ].every(path => !existsSync(path))
    ).toBe(true)

    doEnv(undefined)
  })

  it("with schema", () => {
    doEnv({
      "type": "object",
      "properties": {
        "NODE_ENV": {"type": "string"}
      }
    })
  })
})