import { randomInt } from "crypto"
import { properties } from "../env.schema.json"
import { maskPattern } from "./encryption"
import { nop, nop2 } from "./fn"
import type {
  Arg1,
  Dict,
  Logger,
  LoggerMethod,
  LogLevel,
  WithLogger
} from "./ts-utils.types"

const {stringify: $stringify} = JSON
, {now} = Date
, {defineProperty: $defineProperty} = Object
, logLevels = properties.LOG_LEVEL.enum
//@ts-expect-error
, logDepth: number = process.env.LOG_DEPTH || 1
, consoleLevels = new Set(["info", "log", "debug", "warn", "error", "off"] as const)
//@ts-expect-error
, chars: string = process.env.LOG_TRACE_CHARS ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+*<>=_~@#%:^$"
, { "length": charsLength } = chars
, /** @deprecated */ logger = loggize({})
, MAX_LENGTH = 10

let logLevel = logLevels.indexOf(
  //@ts-expect-error
  process.env.LOG_LEVEL ?? "info"
)

/* istanbul ignore next */
logLevel === -1 && (logLevel = logLevels.indexOf("warn"))

export {
  assignLogger,
  formatLog,
  logger
}

function loggize<T extends {"trace"?: undefined|string}>(
  request: T,
  c = console as Pick<typeof console, LogLevel & keyof typeof console> & {[k in Exclude<LogLevel, keyof typeof console>]?: never}
) {
  const trace = request.trace = `${
    request.trace?.toString()
    ?? `${now()}.`
  }${
    traceChar()
  }`
  , toString = () => trace

  return new Proxy(
    {
      toString,
      "toJSON": toString,
      "toBSON": nop2,
      [Symbol.toPrimitive]: toString
    } as unknown as Logger,
    {
      get(source, levelName: LogLevel) {
        if (levelName in source)
          return Reflect.get(source, levelName)

        const logLevelIndex = logLevels.indexOf(
          //@ts-ignore
          levelName
        )

        if (logLevelIndex < logLevel)
          return source[levelName] = nop

        return source[levelName] = ((params, ...opts) => {
          let out = `trace=${trace} levelName=${levelName}`

          if (params === null || typeof params !== "object")
            out = `${out} message=${stringify(params, logDepth)}`
          else
            for (const key in params) {
              const value = params[key]

              if (value === undefined)
                continue

              out = `${out} ${key}=${stringify(value, logDepth)}`
            }

          const {length} = opts

          for (let i = 0; i < length; i++)
            out += ` ${
              levelName === "error" ? $stringify(opts[i])
              : stringify(opts[i], logDepth)
            }`

          /* istanbul ignore next */
          const consoleMethod = consoleLevels.has(levelName)
          ? levelName
          : "log"

          c[consoleMethod]?.(maskPattern(out))
        }) as LoggerMethod
      }
    }
  )
}

function stringify(arg: unknown, maxLogDepth: number ) {
  return arg === null || typeof arg !== "object"
  ? arg
  : formatLog(arg as Dict, maxLogDepth);
}

function assignLogger<T extends WithLogger<Dict>>(request: T, c?: Arg1<typeof loggize>, signal?: AbortSignal) {
  try {
    $defineProperty(request, "trace", {
      "configurable": false,
      "enumerable": true,
      "writable": false,
      "value": loggize(request, c)
    })
  } catch (_) {}

  try {
    $defineProperty(request, "signal", {
      "configurable": false,
      "enumerable": false,
      "writable": false,
      "value": signal
    })
  } catch (_) {}


  return request as WithLogger<T>
}


const depthKey = Symbol("depth")

function formatLog(logObj: Readonly<unknown>, maxLogDepth: number, depth = 0) {
  return $stringify(logObj, function(_, val) {
    if (val === null || typeof val !== "object")
      return val
    
    const d = 1 + (this[depthKey] ?? depth)

    if (d - 1 > maxLogDepth || val.length > MAX_LENGTH) {
      const {name} = val.constructor

      return `[${
        name
      }${
        name === "Object" ? ""
        : "length" in val ? ` ${(val as Dict).length}`
        : "size" in val ? ` ${(val as Dict).size}`
        : ""
      }]`
    }

    if (depthKey in val)
      val[depthKey] = d
    else 
      $defineProperty(val, depthKey, {
        "value": d,
        "enumerable": false,
        "writable": true
      })

    return val
  })
}

function traceChar() {
  return chars[randomInt(charsLength)]
}