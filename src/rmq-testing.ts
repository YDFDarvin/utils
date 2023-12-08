import { connect } from "amqp-connection-manager";
import { channelCreate } from "./amqp";
import { toRmq } from "./rmq";
import type {
  Arg0,
  Arg1,
  Dict,
  Fn,
  Return
} from "./ts-utils.types";

export {
  createConsumer,
  consumer4test
};

function consumer4test<T extends Dict<Fn>>(
  opts: Arg0<typeof createConsumer>,
  handler: (nestWrap: {[k in keyof T]: {"pattern": k, "data": Arg0<T[k]>}}[keyof T]) => unknown
  // TODO Consider handler: {[k in keyof T]: (nestWrap: {"pattern": k, "data": Arg0<T[k]>}) => ReturnType<T[k]>}[keyof T],
) {
  const $return = {} as Return<ReturnType<typeof createConsumer>["start"]>

  beforeAll(async () => {
    Object.assign($return, await createConsumer(
      opts,
      handler
    ).start())
  })

  afterAll(async () => $return.close())

  return $return
}

function createConsumer<T extends Dict<Fn>>(
  opts: Arg1<typeof channelCreate> & {
    "urls": Arg0<typeof connect>
  },
  handler: (nestWrap: {[k in keyof T]: {"pattern": k, "data": Arg0<T[k]>}}[keyof T]) => unknown
  // TODO Consider handler: {[k in keyof T]: (nestWrap: {"pattern": k, "data": Arg0<T[k]>}) => ReturnType<T[k]>}[keyof T],
) {
  async function start() {
    const connection = connect(opts.urls,
      //@ts-expect-error
      opts.socketOptions
    )
    , channel = channelCreate(connection, opts,
      p => toRmq(handler(p as any))
    )
  
    async function close() {
      await channel.close()
      await connection.close()    
    }
  
    const service = {
      connection,
      channel,
      close
    }

    await connection.connect()
    await channel.waitForConnect()

    return service
  }

  return {start}
}