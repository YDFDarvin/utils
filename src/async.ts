import { fill } from "./array"
import { invoke } from "./fn"
import type {
  falsy,
  Fn,
  Mutate,
  OneOf2,
  Return
} from "./ts-utils.types"

export {
  $all,
  bulkRead,
  collect2map,
  sleep,
  afterTick,
  afterImmediate,
  repeatedly,
  waitFor,
  parallel,
  reduce,
  closeCursor,
  sequence,
  toArray,
  abortize,
  signalize,
  makeAbort,
  getIteredValue,
  yieldPromises,
  limit,
  makeRunner
}
export type {
  Cursor,
  Signalize
}

type Cursor<T> = {
  [Symbol.asyncIterator](): AsyncIterator<T, void>
}
& OneOf2<
  Pick<AsyncIterator<T, void>, "next"|"return">,
  {
    next(): Promise<T | null>
    close(): Promise<unknown>
  } & Pick<NodeJS.EventEmitter, "once">
>
/** @example
 * const {signal = idfn} = payload
 * , items1 = await signal(collection1.find()).toArray()
 * 
 * for await (const item of signal(collection2.find()))
 *   for (let i = items1.length; i-->0;) {
 *     signal.throwIfAborted()
 * 
 *     //do stuff
 *   }
 * 
*/
type Signalize = {
  <C extends Cursor<any>>(cursor: C): C
  throwIfAborted?(): void
}
const {keys: $keys, assign: $assign} = Object
, {isArray: $isArray} = Array
, abortError = $assign(new Error("This operation was aborted"), {"code": 20, "name": "AbortError"})

async function* bulkRead<S extends Iterable<unknown> | AsyncIterable<unknown>>(size: number, source: S) {
  let bulk: Array<
    S extends Iterable<infer T> ? T
    : S extends AsyncIterable<infer T> ? T
    : never
  > = []

  try {
    for await (const item of
      //@ts-expect-error
      source
    ) {
      if (size > bulk.push(item)) 
        continue

      yield bulk

      bulk = []
    }

    if (bulk.length !== 0)
      yield bulk
  } catch (e) {
    //@ts-expect-error
    await closeCursor(source)
  }
}

async function collect2map<T,
  S extends Iterable<T> | AsyncIterable<T>,
  K extends {[k in keyof T]: T[k] extends string ? k : never}[keyof T]
>(source: S, key: K, projKey?: boolean|string) {
  //@ts-expect-error
  const $return = {} as {[k in T[K]]: Omit<T, K> | Array<Omit<T, K>>}

  //@ts-expect-error
  for await (const item of source) {
    const id = item[key]
    //@ts-ignore
    , prev = $return[id]

    if (prev === undefined)
      //@ts-ignore
      $return[id] = item
    else if ($isArray(prev))
      prev.push(item)
    else 
      //@ts-ignore
      $return[id] = [prev, item]
    
    if (projKey !== true) {
      delete item[key]

      if (projKey)
        item[projKey] = id
    }
  }

  return $return
}

async function $all<P extends Record<string, falsy|PromiseLike<unknown>>>(promises: P) {
  const $return = {} as {[p in keyof P]: Awaited<P[p]>}
  , keys = $keys(promises) as Array<keyof P>
  , proms = keys as unknown as PromiseLike<unknown>[]

  for (let k = keys.length; k-->0;) {
    const key = keys[k]
    , prom = promises[key]
    
    if (typeof prom !== "object" || typeof prom?.then !== "function") {
      //@ts-expect-error
      $return[key] = prom
    } else {
      proms[k] = invoke(async () => {
        const r = await prom
        $return[key] = r
      })
    }
  }

  await Promise.all(proms)

  return $return
}

function sleep(timeout: number) {
  return new Promise<void>(res => setTimeout(res, timeout))
}

function afterTick() {
  return new Promise<void>(res => process.nextTick(res))
}

function afterImmediate() {
  return new Promise<void>(res => setImmediate(res))
}

async function repeatedly<T>(length: number, creator: (i: number) => Promise<T>) {
  return await Promise.all(fill(length, creator))
}

async function waitFor(
  condition: () => boolean|Promise<boolean>,
  {interval, maxCalls}: {
    "interval": number
    "maxCalls": number
  }
) {
  let value: Return <typeof condition>

  while (!(value = await condition()) && maxCalls--)
    await sleep(interval)
    
  return value
}

/** @deprecated only for tests */
function toArray<T>(iterator: Iterable<T>|AsyncIterable<T>) {
  return reduce(iterator, (arr, item) => {
    arr.push(item)
    return arr
  }, [] as T[])
}

async function reduce<T, R>(
  iterator: Iterable<T>|AsyncIterable<T>,
  fn: (acc: R, item: T) => R,
  initial: R
) {
  for await (const item of iterator) 
    initial = fn(initial, item)

  return initial
}

type List<T> = {value?: T, n?: List<T>}

const Done = {"done": true as const, "value": undefined} as IteratorReturnResult<void>

// Consider inference like
// function parallel<T0, C extends Cursor<any>[] = Cursor<T0>[]>(cursors: C) {
//   type T = Exclude<Return<C[number]["next"]>, null|void|undefined>
function parallel<T>(cursors: Cursor<T>[]) {
  let {length} = cursors
  , head = {} as List<T>
  , tail = head
  , cb: undefined | Fn = undefined
  , closing = false
  , err: unknown = undefined

  async function close() {
    closing = true

    await Promise.allSettled(cursors.map(closeCursor))

    return Done
  }

  cursors.map(async cursor => {
    try {
      let pointer = cursor[Symbol.asyncIterator]()
      , next: Return<typeof pointer["next"]>

      while (next = await pointer.next()) {
        if (closing || next.done)
          break

        tail = head.value === undefined
        // TODO strictNullChecks=true @ btc-node
        ? head = next as IteratorYieldResult<T>
        : tail.n = next as IteratorYieldResult<T>
          
        if (cb) {
          cb()
          cb = undefined
        }
      }
    } catch (e) {
      closing = true
      err = e
      await close()
    }

    length--

    if (!length && cb) {
      cb()
      cb = undefined
    }
  })
    
  async function next() {
    if (length && head.value === undefined)
      await new Promise(res => cb = res)
      
    // TODO
    if (err) 
      throw err

    if (!length && !head.value && !head.n)
      // TODO Consider promises
      return Done 
                
    const $return = head as Mutate<List<T>, IteratorYieldResult<T>>

    head = head.n || {}

    delete $return.n 

    return $return as IteratorYieldResult<T>
  }

  const paralleled = {
    next,
    "throw": close,
    "return": close,
  }
  , generator = {
    next,
    "throw": close,
    "return": close,
    [Symbol.asyncIterator](){ return paralleled }
  }

  return generator
}

/** @deprecated */
function yieldPromises<T>(promises: Promise<T>[]) {
  let {length} = promises
  , head = {} as List<T>
  , tail = head
  , cb: undefined | Fn = undefined

  promises.forEach(p => invoke(async () => {
    const value = await p
    , next = {value}

    tail = head.value === undefined
    ? head = next
    : tail.n = next

    if (cb) {
      cb()
      cb = undefined
    }
  }))

  async function close() {
    return Done
  }

  async function next() {
    if (length && head.value === undefined)
      await new Promise(res => cb = res)

    if (!length)
      return Done
  
    const $return = head as Mutate<List<T>, IteratorYieldResult<T>>

    head = head.n || tail

    if (head === tail)
      tail = {}

    delete $return.n 

    length--

    return $return    
  } 
  
  const yielded = {
    next,
    "throw": close,
    "return": close,
  }
  , generator = {
    next,
    "throw": close,
    "return": close,
    [Symbol.asyncIterator](){ return yielded }
  }

  return generator 
}

async function* sequence<T>(cursors: Cursor<T>[]) {
  const {length} = cursors

  try {
    for (let c = 0; c < length; c++) {
      const cursor = cursors[c]
      yield* cursor
    }
  } finally {
    await Promise.all(cursors.map(cursor => closeCursor(cursor)))
  }
}

function closeCursor(c: Cursor<any>) {
  return c.close?.() ?? c.return?.()
}

function getIteredValue<T>(v: IteratorResult<T> | T): T {
  if (v === null)
    // `as T` is needed due to poor superprojects with `"strictNullChecks": false`
    return v as T

  if (typeof v !== "object")
    return v

  //@ts-ignore Some dump ts stuff
  for (const k in v) 
    if (k !== "done" && k !== "value") 
      return v as T

  const {done} = v as IteratorResult<T>

  if (typeof done !== "boolean" || !("value" in v))
    return v as T

  return v.value
}

function signalize(signal: AbortSignal) {
  function signalize<C extends Cursor<any>>(cursor: C) {
    return abortize(signal, cursor)
  }

  /* istanbul ignore next */
  signalize.throwIfAborted =
  //@ts-ignore no declaration in @types/node 
  signal.throwIfAborted
  //@ts-ignore Branch for Node v18
  ? () => signal.throwIfAborted()
  // Branch for Node v16
  : () => {
    if (signal.aborted)
      //@ts-ignore in Node v18
      throw signal.reason ?? abortError
  }
  
  return signalize as Signalize
}

function abortize<C extends Cursor<any>>(signal: AbortSignal, cursor: C) {
  const aborting = () => {
    //@ts-ignore in Node v16
    signal.removeEventListener("abort", aborting)
    return closeCursor(cursor)
  }

  //@ts-ignore in Node v16
  signal.addEventListener("abort", aborting)

  cursor.once?.("close", aborting)

  return cursor
}

function makeAbort() {
  const controller = new AbortController()
  , signal = signalize(controller.signal)  

  return {controller, signal}
}

async function* limit<T>($limit: number, cursor: Cursor<T>) {
  let counter = 0

  // TODO Check is try-catch is overkill or needs to be for mongo
  try {
    for await (const obj of  cursor) {
      yield obj

      if(!(++counter < $limit))
        await closeCursor(cursor)
    }
  } catch (e) {
    await closeCursor(cursor)
    throw e
  }
}

/** 
 * Usage
 * ```
 * const runner = makeRunner(cursor, transformFn)
 * 
 * for await (const obj of parallel(fill(10, runner))) {
 *   ...
 * }
 * ```
 */
function makeRunner<T, R>(
  source: AsyncIterable<T> | Iterable<T>,
  transform: (item: T) => R | Promise<R>
) {
  const pointer = Symbol.asyncIterator in source ? source[Symbol.asyncIterator]()
  : source[Symbol.iterator]()

  async function* runner() {
    let next: Return<typeof pointer["next"]>

    while (next = await pointer.next()) {
      if (next.done)
        return

      yield await transform(next.value)
    }
  }

  return runner
}