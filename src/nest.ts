import {
  INestMicroservice,
  Module,
  Type
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  ClientProviderOptions,
  ClientRMQ,
  ClientsModule,
  Ctx,
  EventPattern,
  MessagePattern,
  MicroserviceOptions,
  Payload,
  RmqContext,
  RmqOptions,
  ServerRMQ,
  Transport
} from "@nestjs/microservices";
import type { Logger } from "ajv";
import type {
  AmqpConnectionManager,
  ChannelWrapper
} from "amqp-connection-manager";
import type {
  Connection,
  Message,
  Options
} from "amqplib";
import type { Server } from "http";
import {
  makeAbort,
  sleep
} from "./async";
import { RmqDynamicPrefetchStrategy } from './dynamic-prefetch/rmqDynamicPrefetchStrategy';
import { invoke, nopPromise } from "./fn";
import {
  assignLogger,
  logger
} from "./logger";
import type { checkApp } from "./nest-check";
import { init } from "./prom-client";
import { toRmq } from "./rmq";
import type {
  Arg0,
  Arg1,
  Fn,
  OneOf2,
  PartUndef,
  Replace,
  Require,
  WithLogger
} from "./ts-utils.types";
import { createWealth } from "./wealth-node";
import signals = require("./signals.json")

/** @see [@nest/constants](../node_modules/@nestjs/microservices/constants.js) */
export type RmqOpts = Replace<
  Require<NonNullable<RmqOptions["options"]>, "queue"|"urls">, {
  "queueOptions": Options.AssertQueue
  /** @see [@server-rmq.js:63](node_modules/@nestjs/microservices/server/server-rmq.js) */
  "socketOptions"?: PartUndef<AmqpConnectionManager["connectionOptions"] & Pick<
    AmqpConnectionManager,
    "heartbeatIntervalInSeconds"|"reconnectTimeInSeconds"
  >>
  "noAck"?: NonNullable<RmqOptions["options"]>["noAck"]
}> & {
  "reconnectAttempts"?: undefined|number
}

export type NestRmqService = INestMicroservice
& NestContainer
& OneOf2<
  { "server": NestServerRmq },
  {
    "microservices": Array<NestRmqMicroService>
  }
  & Partial<{
    "isInitialized": boolean
    "isListening": boolean // httpServer.listening: boolean
    "httpServer": Server
    // {
    //   "listening": boolean
    // }
  }>
>

type NestRmqMicroService = INestMicroservice
& NestContainer
& { "server": NestServerRmq }

type NestContainer = {
  "container": {
    "globalModules": Set<unknown>
    "dynamicModulesMetadata": Map<string, unknown>
    "modules": Map<string, unknown>
  }
}

export type NestServerRmq = Omit<ServerRMQ, "channel"|"server"|"options">
& RmqOpts
& {
  "channel": ChannelWrapper
  "server": AmqpConnectionManager & {
    "connection": Connection
  },
  "options": RmqOpts
}

export type NestRmqClient = Omit<ClientRMQ, "client"|"channel"|"connection"|"connect"> & {
  "options": RmqOpts
  "client": null|AmqpConnectionManager
  "channel": null|ChannelWrapper
  "connection": Promise<void>
  "connect": () => Promise<void>
} & {
  "reconnectId"?: undefined|NodeJS.Timeout
  "disabled"?: boolean
}
export type WealthOpts = Arg0<typeof init> & Arg1<typeof checkApp>

export {
  ERROR_404,
  RmqApiModule,
  RmqController,
  RmqHandler,
  appendWealth,
  closePropagator,
  getHandlerByPattern,
  startRmqService,
  startRmqServiceWithWealth,
  withReconnect
};

const {
  getOwnPropertyNames: $getOwnPropertyNames,
  getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
  defineProperty: $defineProperty
} = Object
, {now} = Date
, rmqConsumerTimeout = 225000
, ERROR_404 = new Error("404")

delete ERROR_404.stack

async function startRmqService<T>(appMod: T, options: RmqOpts, l: Logger = logger) {
  let appRef = {} as {"app": undefined|NestRmqMicroService}

  const {RMQ_DYNAMIC_PREFETCH_ENABLED} = process.env

  closePropagator(appRef)

  const app = appRef.app = await NestFactory.createMicroservice<MicroserviceOptions>(appMod,
    //@ts-expect-error
    RMQ_DYNAMIC_PREFETCH_ENABLED && RMQ_DYNAMIC_PREFETCH_ENABLED !== "false" && RMQ_DYNAMIC_PREFETCH_ENABLED !== "null" && RMQ_DYNAMIC_PREFETCH_ENABLED !== "0"
    ? {
      strategy: new RmqDynamicPrefetchStrategy(options),
    }
    : {
      "transport": Transport.RMQ,
      options
    }
  ) as NestRmqMicroService 

  app.enableShutdownHooks(signals)
  app.useLogger(l)

  //@ts-ignore Weird ts-error
  app.server.getHandlerByPattern = getHandlerByPattern
  
  //@ts-ignore Backward compatibility with nest@7
  await app.listen()

  // For some manual connection-disconnection logic
  // const {server} = app.server
  // server.on("connect", () => console.log("server connect"))
  // server.on("disconnect", () => console.log("server disconnect"))

  // Hybrid
  // const app = await NestFactory.create(MonitoringModule);
  // app.connectMicroservice({
  //   "transport": Transport.RMQ,
  //   "options": rmqMonitor,
  // } as RmqOptions)
  
  // await app.startAllMicroservices()  
  
  return app
}

/** Don't mess with `@Liveness` */
function RmqController<F extends Function & {"prototype": Arg0<typeof RmqHandler>}>(
  Class: F
) {
  const {prototype} = Class
  , methods = $getOwnPropertyNames(prototype)

  for (let m = methods.length; m-->0;) {
    const methodName = methods[m]

    if (
      typeof prototype[methodName] !== "function"
      || methodName === "constructor"
      || methodName === "liveness"
    )
      continue

    const desc = $getOwnPropertyDescriptor(prototype, methodName)

    RmqHandler(
      prototype,
      methodName,
      //@ts-ignore
      desc
    )
  }
}

/** Don't mess with `@Liveness` */
function RmqHandler<
  T,
  K extends Extract<keyof T, string>
>(
  target: T & {[k in K]: Fn} & {
    "logger"?: {
      "error": (...args: any[]) => void
    }
    "TIMEOUT"?: number
    "noLog"?: Set<string>
    /** @deprecated */
    "liveness"?: () => Promise<unknown>
  },
  method: K,
  desc: TypedPropertyDescriptor<T[K] & Fn>
) {
    const fn = desc.value!
      
    Payload()(target, method, 0)
    Ctx()(target, method, 1)

    const wrapped = async function(this: typeof target, payload: Arg0<typeof target[K]> = {}, context: undefined|RmqContext) {
      const {logger, noLog} = this
      , {controller, signal} = makeAbort()
      , liveness = method !== "onModuleInit" && method !== "onModuleDestroy" && this.liveness || nopPromise
      //@ts-expect-error
      , {trace = console}: WithLogger<{}> = payload = assignLogger(payload, logger, signal)
      , isMethodLogAllowed = !noLog?.has(method)

      isMethodLogAllowed && trace.log({method}, payload)
      
      let isMessage = false
      , ack: (result: boolean) => void = nop
      , acked = false

      if (context) {
        const channel: ChannelWrapper = context.getChannelRef()
        , message = context.getMessage() as Message

        isMessage = !!message.properties.replyTo
        
        ack = succeeded => {
          if (acked)
            return trace.warn({method, "reason": "Double ack"})

          acked = true

          succeeded
          ? channel.ack(message)
          : channel.nack(message, false, !isMessage && !message.fields.redelivered)
        }
      }

      const timeoutId = setTimeout(() => {
        controller.abort()
        ack(false)
        trace.warn({method, "reason": "timeout"})
      }, this.TIMEOUT ?? rmqConsumerTimeout)
      ,  started = now()

      try {        
        const resp = await toRmq(invoke(async () => {
          await liveness()

          return await fn.call(this, payload)
        }))
          
        const logPayload = {method, "duration": now() - started}

        if (resp.success)
          isMethodLogAllowed && trace.log(logPayload, payload, resp)
        else {
          if (isMessage)
            isMethodLogAllowed && trace.warn(logPayload, payload, resp)
          else
            throw resp
        }

        clearTimeout(timeoutId)
        ack(true)
        
        return resp
      } catch (error) {
        clearTimeout(timeoutId)
        ack(false)
        
        isMethodLogAllowed && trace.error({method, "duration": now() - started}, payload, error)
        
        throw error
      }
    }

    $defineProperty(wrapped, "name", {"value": method})
    //@ts-expect-error
    desc.value = wrapped

    $defineProperty(target, method, desc)

    MessagePattern(method)(target, method, desc)
    EventPattern(method)(target, method, desc)  
  }

function RmqApiModule(rmqParams: RmqOpts, instance: Type<unknown>): ClassDecorator {
  return (target) => {
    Module({
      "imports": [
        ClientsModule.register([
          {
            "name": rmqParams.queue,
            "transport": Transport.RMQ,
            "options": rmqParams
          } as ClientProviderOptions & RmqOptions,
        ])
      ],
      "providers": [instance],
      "exports": [instance],
    })(target)
  }
}

async function startRmqServiceWithWealth(
  opts: Arg1<typeof appendWealth>,
  rmqOpts: Arg1<typeof startRmqService>,
  m: Arg0<typeof startRmqService>,
) {
  const appPromise = startRmqService(m, rmqOpts)
  , health = appendWealth(appPromise, opts)
  , app = await appPromise

  return {
    app,
    health,
    close() {
      return Promise.allSettled([
        app.close(),
        /* istanbul ignore next */
        health?.close()
      ])
    }
  } 
}

function appendWealth(
  appPromise: Arg0<typeof createWealth>,
  opts: Replace<
    Arg0<typeof init> & Arg1<typeof createWealth>,
    Partial<
      Pick<Arg0<typeof init>, "prefix">
      & Pick<Arg1<typeof createWealth>, "port">
    >
  >
) {
  let health: undefined|Server = undefined

  if (opts.prefix !== undefined)
    //@ts-expect-error ts doesn't see condition so Type 'string | undefined' is not assignable to type 'string'
    init(opts)
  
  if (opts.port)
    health = createWealth(appPromise,
      //@ts-expect-error ts doesn't see condition so Type 'number | undefined' is not assignable to type 'number'.
      opts
    )

  return health
}

/**
 * @example
 * opt 1
 * ```typescript
 * (await NestMicroservice.createMicroservice)
 * .server.getHandlerByPattern = getHandlerByPattern
 * ```
 * opt 2
 * ```typescript
 * (await NestMicroservice.create)
 * .server.getHandlerByPattern = getHandlerByPattern
 * ```
 */
function getHandlerByPattern(this: ServerRMQ, pattern: string) {
  const route = this.getRouteFromPattern(pattern);
  
  return this.messageHandlers.get(route)
  ?? handler404
}

async function handler404(
  _req: unknown,
  {"args": [message, channel, _pattern]}: {"args": [Message, ChannelWrapper, string]}
) {
  channel.nack(message, false, false)

  return toRmq(new Promise((_, rej) => rej(ERROR_404)))
}

async function withReconnect(client: NestRmqClient) {
  const {options} = client
  , reconnectTimeout = 1000 * (options.socketOptions?.reconnectTimeInSeconds ?? 1)
  , reconnectAttempts = options.reconnectAttempts || Infinity

  for (let r = reconnectAttempts; r-->0;)
    try {
      if (client.disabled)
        return

      const connect = client.connect()

      client.client!.once("disconnect", e => {
        //@ts-expect-error For no queue the error is `{code: 404, classId: 50, methodId: 10}`
        if (e.err?.context?.code === 404)
          return
        
        console.error(e)

        client.reconnectId = setTimeout(() =>
          withReconnect(client)
        , reconnectTimeout)
      })
    
      const connection = await connect

      console.log(`Reconnected after ${reconnectAttempts - r} attempts`)

      return connection;
    } catch (e) {
      console.error(e)
      client.close();

      await sleep(reconnectTimeout)
    }
  
  throw new Error(`Reconnect failed after ${reconnectAttempts} attempts`)
}

function closePropagator<App extends {"close": () => any}>(appRef: {"app"?: undefined|App}) {
  for (const s of signals)
    process.once(s, () => {
      const {app} = appRef

      if (app)
        app.close()
      else
        throw Error("Signal before app init")
    })  

  return appRef
}

function nop() {} 
