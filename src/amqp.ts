import type { connect } from "amqp-connection-manager";
import type {
  Channel,
  ConfirmChannel,
  Replies
} from "amqplib";
import type { RmqOpts } from "./nest";
import type {
  Arg0,
  Arg1,
  Return
} from "./ts-utils.types";

const {parse: $parse, stringify: $stringify} = JSON
, {from: $from} = Buffer

export {
  channelCreate,
  consumeWrap
};

type NestPayloadWrap<P = any> = {
  "pattern": string
  "data": P
}

function channelCreate<P>(
  connection: Pick<Return<typeof connect>, "createChannel">,
  {queue, queueOptions}: Pick<RmqOpts, "queueOptions"|"queue">,
  handler: (payload: NestPayloadWrap<P>) => unknown
) {
  const channel = connection.createChannel({
    "json": false,
    "setup": (channel: ConfirmChannel) => Promise.all([
      channel.assertQueue(queue, queueOptions),
      channel.consume(queue, consumeWrap(channel, handler))
    ])
  })

  // CONSIDER await channel.waitForConnect()

  return channel
}

/**
 * @param channel Maybe `Channel`
 * @todo check https://stackoverflow.com/questions/69436001/not-receiving-messages-in-the-reply-queue-that-sent-to-rabbitmq-using-amqplib-an
*/
function consumeWrap<T extends NestPayloadWrap>(channel: ConfirmChannel, handler: (payload: T) => unknown) {
  return async function(msg: Arg0<Arg1<Channel["consume"]>>) {
    /* istanbul ignore next */
    if (!msg)
      return

    // CONSIDER .nack, .reject, .recover
    let $return: Return<typeof handler>

    try {
      const payload = $parse(msg.content.toString())

      $return = await handler(payload)
      channel.ack(msg)
    } catch(e) /* istanbul ignore next */ {
      console.error(e)
      channel.nack(msg)

      $return = e
    }

    const {replyTo, correlationId} = msg.properties

    return !replyTo ? undefined : new Promise<Replies.Empty>((res, rej) =>
      channel.sendToQueue(
        replyTo,
        $from($stringify($return)),
        {
          correlationId,
        },
        /* istanbul ignore next */
        (err, ok) => err ? rej(err) : res(ok)
      )
    )
  }
}
