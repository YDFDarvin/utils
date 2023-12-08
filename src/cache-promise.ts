import { isDeepStrictEqual } from "util"
import { invoke } from "./fn"
import type { primitive } from "./ts-utils.types"

type CacheItem<CheckSum, Value> = {
  "timestamp": number
  "checksum": CheckSum|Promise<CheckSum>
  "prom": Value|Promise<Value>
}

type Params = {
  "ttl": number
  "frame"?: number
  "maxCount": number
}

type Engine<Key, CheckSum, Value> = {
  checksum: (key: Key) => Promise<CheckSum>
  get: (key: Key) => Promise<Value>
}

export {
    CachePromise,
    setWithOrder
}

const {now} = Date

class CachePromise<Key extends primitive, CheckSum, Value> {
  readonly cached = new Map<Key, CacheItem<CheckSum, Value>>()

  constructor(
    readonly params: Params,
    readonly engine: Engine<Key, CheckSum, Value>
  ) {
  }

  get(key: Key,
    params: Params = this.params,
    engine: Engine<Key, CheckSum, Value> = this.engine,
  ): Value|Promise<Value> {
    const {cached} = this
    , n = now()
    , {frame} = params

    let v = cached.get(key)

    const timestamp = v?.timestamp!
    , inFrame = frame && v && timestamp + frame >= n
    , isDead = !v || timestamp + params.ttl < n

    if (!v)
      //@ts-expect-error
      v = {} as typeof v

    setWithOrder(params.maxCount, cached, key, v)

    if (inFrame || v!.prom instanceof Promise)
      return v!.prom

    v!.timestamp = n

    const {prom, checksum} = v!

    const newChecksum = v!.checksum = engine.checksum(key)

    return v!.prom = invoke(async () => {
      const newSum = await newChecksum
      const oldSum = await checksum

      if (!isDead && isDeepStrictEqual(newSum, oldSum)) {
        v!.checksum = newSum

        return v!.prom = await prom
      }

      v!.checksum = newSum
     
      return await (v!.prom = invoke(async () => {
        const value = await engine.get(key)
        v!.prom = value
        return value
      }))
    })
  }

  clear() {
    return this.cached.clear()
  }

  get size() {
    return this.cached.size
  }
}

function setWithOrder<k, v>(maxSize: number, m: Map<k, v>, key: k, value: v) {
  m.delete(key)

  const deleteCount = m.size + 1 - maxSize 

  if (deleteCount > 0) {
    const iter = m.keys()

    for (let d = deleteCount; d-->0;) {
      const n = iter.next()

      /* istanbul ignore next: Impossible because it is sync here, but nevertheless */
      if (
        n.done
        || m.size + 1 - maxSize <= 0
      )
        break

      m.delete(n.value)
    }
     
  }

  m.set(key, value)

  return m
}
