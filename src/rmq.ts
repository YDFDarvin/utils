import { Inject } from "@nestjs/common";
import type {
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common/interfaces/hooks";
import { ClientRMQ, RmqRecord } from "@nestjs/microservices";
import type { ChannelWrapper } from "amqp-connection-manager";
import type { NestRmqClient, RmqOpts } from "./nest";
import { withReconnect } from "./nest";
import "./set";
import type {
  Arg0,
  Arg2,
  Arg3,
  Dict,
  Fn
} from "./ts-utils.types";

const {assign: $assign} = Object
, {from: $from} = Buffer
, {stringify: $stringify} = JSON

, publisherTimeout = 300000

export type RmqWrap<R> = {
  "success": true
  "data": R
} | {
  "success": false
  "data": any
}

export {
  RmqClientFactory,
  rmqEmit,
  rmqSend,
  toRmq,
  rmqNativeEmit
};

type RmqEmitter<Interface extends Record<string, undefined|Fn>> = {
  [M in keyof Interface]: (
    payload: Arg0<NonNullable<Interface[M]>>,
    opts?: Arg3<typeof rmqEmit>
  ) => Promise<boolean>
}

type RmqSender<Interface extends Record<string, undefined|Fn>> = {
  [M in keyof Interface]: (
    payload: Arg0<NonNullable<Interface[M]>>,
    opts?: Arg3<typeof rmqSend>
  ) => ReturnType<NonNullable<Interface[M]>>
}

/**
 * @example _
 * ```typescript
 * @Injectable()
 * export class XxxApi extends RmqClient<XxxInterface> {
 *   @Inject(rmqXxxOpts.queue)
 *   client!: RmqClient<XxxInterface>["client"]
 * }
 * ```
 * @see RmqClientFactory 
 */
export abstract class RmqClient<Interface extends Dict<undefined|Fn>>
  implements Required<OnModuleInit & OnModuleDestroy>
{
  abstract client: NestRmqClient

  async onModuleInit() {
    return await withReconnect(this.client)
  }

  onModuleDestroy() {
    const {reconnectId} = this.client

    /* istanbul ignore next: Hard to cause reconnect */
    reconnectId && clearTimeout(reconnectId)
  }

  emit = new Proxy(
    {} as RmqEmitter<Interface>,
    {
      get: <M extends Extract<keyof Interface, string>>(holder: RmqEmitter<Interface>, method: M) => {
        return holder[method] ?? (
          holder[method] = (payload, options) => rmqNativeEmit(this.client, method, payload, options)
        )
      }
    }
  )

  send = new Proxy(
    {} as RmqSender<Interface>,
    {
      get: <M extends Extract<keyof Interface, string>>(holder: RmqSender<Interface>, method: M) => {
        return holder[method] ?? (
          holder[method]
          = (payload, options) => rmqSend(this.client, method, payload, options) as ReturnType<NonNullable<Interface[M]>>
          )
      }
    }
  )
}

/**
 * @example _
 * ```typescript 
 * export class XxxApi extends RmqClientFactory<XxxInterface>(rmqXxxOpts) {}
 * ```
 */
function RmqClientFactory<I extends Dict<undefined|Fn>>({queue}: {"queue": string}) {
  const RmqApi = class RmqApi extends RmqClient<I> {
    constructor(
      readonly client: RmqClient<I>["client"]
    ) {
      super()
    }
  }

  Inject(queue)(RmqApi, "client", 0)

  //@ts-ignore https://github.com/microsoft/TypeScript/issues/42645
  return RmqApi
}

async function rmqSend<R, P = unknown>(
  client: Pick<ClientRMQ, "send">,
  method: string,
  payload: P,
  options?: ConstructorParameters<typeof RmqRecord>[1] & Partial<{
    "timeout": number
  }>
) {
  const msg = options ? new RmqRecord(payload, options) : payload
  , res = await new Promise<RmqWrap<R>>(async (res, rej) => {
    if ((client as NestRmqClient).disabled)
      rej(new Error("Disabled"))

    let data: {
      "success": boolean
      "data": R
    }
    , timeoutId: NodeJS.Timeout

    const subscription = client.send(method, msg).subscribe(
      //@ts-ignore
      v => data = v,
      //@ts-ignore
      err => {
        clearTimeout(timeoutId)
        rej(err)
      },
      () => {
        clearTimeout(timeoutId)
        res(data)
      }
    )

    timeoutId = setTimeout(() => {
      subscription.unsubscribe()
      rej(new Error("timeout"))
    }, options?.timeout ?? publisherTimeout)
  })

  if (res.success)
    return res.data as R
  else
    throw $assign(Error(), res.data)
}

/** @deprecated use `rmqNativeEmit` */
async function rmqEmit<P = unknown>(
  client: Pick<ClientRMQ, "emit">,
  method: string,
  payload: P,
  options?: ConstructorParameters<typeof RmqRecord>[1] & Partial<{
    "timeout": number
  }>
) {
  const msg = options ? new RmqRecord(payload, options) : payload
  , res = await new Promise<true>(async (res, rej) => {
    if ((client as NestRmqClient).disabled)
      rej(new Error("Disabled"))

    let timeoutId: NodeJS.Timeout

    const subscription$ = client.emit(method, msg).subscribe({
      //@ts-ignore
      next: (v) => v,
      //@ts-ignore
      error: (e) => {
        clearTimeout(timeoutId)
        rej(e)
      },
      complete: () => {
        clearTimeout(timeoutId)
        res(true)
      },
    })

    /* istanbul ignore next */
    timeoutId = setTimeout(() => {
      subscription$.unsubscribe()
      rej(new Error("timeout"))
    }, options?.timeout ?? publisherTimeout)
  })

  return res
}

async function toRmq<R>(promise: R|Promise<R>): Promise<RmqWrap<R>> {
  try {
    const data = await promise

    return {"success": true, data}
  } catch (e: any) {

    /* istanbul ignore next @see https://github.com/facebook/jest/issues/3190#issuecomment-671085357 */
    return { "success": false, "data": {
      "messageType": e.name,
      "message": e.message,
      "stack": e.stack,
      ...e,
    }}
  }
}

/** @returns Whatever `false` means, message in queue */
async function rmqNativeEmit<P = unknown>(
  {channel, "options": {queue, persistent}}: {
    "channel": null|ChannelWrapper,
    "options": RmqOpts
  },
  method: string,
  payload: P,
  /** @see https://amqp-node.github.io/amqplib/channel_api.html#channelpublish */
  options?: Arg2<ChannelWrapper["sendToQueue"]>
) {
  const content = $from($stringify({
    "pattern": method,
    "data": payload
  }))
  , opts = {
    persistent,
    ...options, 
  }

  return await channel!.sendToQueue(
    queue,
    content,
    opts
  )
}
