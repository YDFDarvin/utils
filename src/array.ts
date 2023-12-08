import { isDefined } from "./fn"
import type { AnyObject, Fn } from "./ts-utils.types"

export {
  arrayize,
  ascNumSort,
  fill,
  first,
  shrink,
  sort,
  unflat,
  unflatByChars,
  unflatForEach,
  unique,
  shuffle,
  fromForEach
}

const {
  isArray: $isArray,
  from: $from
} = Array
, {
  ceil: $ceil,
  ceil: $floor,
  random: $random
} = Math

function fill<V>(
  length: number,
  valueOrFn: V & (
    Exclude<V, Fn>
    | (Extract<V, Fn> extends Fn<[number, infer R], infer R> ? Fn<[number, R], R> : never)
  )
): Array<
  | Exclude<V, Fn> 
  | (V extends (i: number) => infer R ? R : never)
> {
  if (typeof valueOrFn !== "function")
    return new Array(length).fill(valueOrFn)

  const generated = new Array()
  
  for (let g = 0; g < length; g++)
    //@ts-expect-error
    generated[g] = valueOrFn(g, generated)

  return generated
}

function unique<T>(source: T[]) {
  return $from(new Set(source))
}

function unflat<T>(maxLength: number, source: T[]) {
  const $return: T[][] = []
  , {length} = source
  , size = $ceil(length / maxLength)
  , step = $ceil(length / size)

  for (let i = 0; i < length; i += step)
    $return.push(source.slice(i, i + step))

  return $return
}

function unflatForEach<T>(maxLength: number, source: {
  length?: number
  size?: number
  forEach(cb: (value: T) => unknown): unknown;
}) {
  const {size, length = size} = source
  , chunkSize = length === 0 ? 0
  : length === undefined ? maxLength
  : $floor(length / $ceil(length / maxLength))
  , chunks: T[][] = []

  if (chunkSize === 0)
    return chunks

  let c = 0

  source.forEach(v => {
    let chunk = chunks[c]
    if (chunk === undefined)
      chunk = chunks[c] = []

    if (chunk.push(v) >= chunkSize) 
      c++
  })

  return chunks
}

function unflatByChars<T extends string>(maxChars: number, source: {
  forEach(cb: (value: T) => unknown): unknown;
}) {
  const chunks: T[][] = []

  let c = 0
  , chars = 0

  source.forEach(v => {
    let chunk = chunks[c]
    if (chunk === undefined)
      chunk = chunks[c] = []

    const {length} = v

    if (!chars || chars + length <= maxChars) {
      chunk.push(v)
      chars += length
    } else {
      c++
      chars = length
      chunks.push([v])
    }
  })

  return chunks
}

function arrayize<T>(item: T) {
  return item === undefined ? undefined as Extract<T, undefined>
  : $isArray(item)
  ? item as Extract<T, any[]>
  : [item] as Exclude<T, any[] | undefined>[]
}

/** Relative https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/ */
function sort<T extends AnyObject>(items: T[], sort: {[k in keyof T]?: -1|1}) {
  return items.sort((i1, i2) => {
    for (const key in sort) {
      const direction = sort[key]

      if (!direction)
        continue

      const t1 = typeIndex(i1, key)
      , t2 = typeIndex(i2, key)

      if (t1 > t2)
        return direction
      else if (t1 < t2)
        return -direction

      const v1 = i1[key]
      , v2 = i2[key]

      if (v1 === v2)
        continue
      
      const answer = v1! > v2! ? direction
      : -direction

      return answer
    }

    return 0
  })
}

/** Relative https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/ */
function typeIndex<T extends AnyObject>(source: T, prop: keyof T) {
  if (!(prop in source))
    return -1

  const value = source[prop]
  , type = typeof value

  return value === undefined ? 0
  : value === null ? 2
  : type === "number" || type === "bigint" ? 3
  : type === "string" || type === "symbol" ? 4
  : type === "object" ? (
    !$isArray(value) ? 5 : 6
  )
  : type === "boolean" ? 9
  : 14
}

function shuffle<T>(array: T[]) {
  const {length} = array

  for (let i = length - 1; i-->0;) {
    const j = $floor($random() * (length - 1))
    , tmp = array[i]

    array[i] = array[j]
    array[j] = tmp
  }

  return array;
}


function ascNumSort(a: number, b: number) {
  return a - b
}

function shrink<T>(base: Array<undefined|T>, predicate: (item: undefined|T) => boolean = isDefined): T[] {
  let empty = 0
  , filled = base.length

  while (empty < filled) {
    while(empty < filled)
      if (predicate(base[empty]))
        empty++
      else break
    
    while(empty < filled)
      if (!predicate(base[filled]))
        filled--
      else break

    base[empty] = base[filled]
    delete base[filled]
  }

  /* istanbul ignore next: Impossible */
  base.length = filled >= empty ? filled : empty

  return base as T[]
}

function first<T>(source: T[]): T|undefined {
  return source[0]
}

function fromForEach<T>(sources: {forEach(callback: (value: T) => any): any}, target: T[] = []) {
  let i = target.length
  sources.forEach(v => (target[i++] = v) as any)

  return target
}
