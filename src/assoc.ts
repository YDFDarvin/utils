import { isDeepStrictEqual } from "util"
import type {
  Arg1,
  Dec,
  Dict,
  falsy,
  Leaves,
  primitive,
  Trajectories,
  WriteAble
} from "./ts-utils.types"

export {
  accumulatorProducer,
  clear,
  deleteUndefined,
  diff,
  firstKey,
  firstValue,
  getDeep,
  groupKey,
  isEmptyObject,
  isMaxProperties,
  iterateRecursive,
  pushToGroup,
  sortKeysAsc,
  tryValues
}
export type {
  AccumulatorArgs,
  DiffActions,
  Trajectories
}

type DiffActions<T> = {[action in "create"|"del"|"modify"|"outdated"]?: Dict<T>}
type AccumulatorArgs<I extends {[k in string]: unknown}> = [
  {[k in keyof I]: unknown},
  {[k in keyof I]: unknown}
]
const {keys: $keys} = Object
, {isArray: $isArray} = Array

function diff<L>(expected: undefined|Dict<L>, received: undefined|Dict<L>): null|DiffActions<L> {
  if (expected === received)
    return null

  if (expected === undefined)
    return {"del": received}

  if (received === undefined)
    return {"create": expected}

  const create: Record<string, L> = {}
  , modify: Record<string, L> = {}
  , del: Record<string, L> = {}
  , outdated: typeof received = {}

  let hasCreate = false
  , hasModify = false
  , hasDel = false

  for (const key in expected) {
    const exp: L = expected[key]
    , rec: L = received[key]

    if (rec === undefined) {
      hasCreate = true
      create[key] = exp
      continue
    } 
    
    if (!isDeepStrictEqual(rec, exp)) {
      hasModify = true
      modify[key] = exp
      outdated[key] = rec
    }
  }

  for (const key in received)
    if (!(key in expected)) {
      hasDel = true
      del[key] = received[key]
    }
  
  return hasCreate || hasModify || hasDel
  ? {
    ...hasCreate && {create},
    ...hasModify && {
      modify,
      outdated
    },
    ...hasDel && {del}
  }
  : null
}

function sortKeysAsc<T extends Dict>(assoc: T): T {
  const keys = $keys(assoc).sort() as Array<keyof T>
  , {length} = keys
  , sorted = {} as T

  for (let k = 0; k < length; k++) {
    const key = keys[k]
    sorted[key] = assoc[key]
  }

  return sorted
}

function isMaxProperties(assoc: Dict, maxProperties: number) {
  for (const _ in assoc) {
    maxProperties--

    if (maxProperties < 0)
      return false
  }

  return maxProperties >= 0
}

function clear<T>(target: Partial<T>): Partial<T> {
  for (const key in target)
    delete target[key]
  
  return target
}

function isEmptyObject(t: object): t is Record<any, never> {
  for (const _ in t)
    return false
  return true
}

function firstKey<T extends Dict>(t: T) {
  for (const k in t)
    return k as keyof T

  return undefined
}

function firstValue<T extends Dict>(t: T) {
  for (const k in t)
    return t[k]

  return undefined
}

function deleteUndefined<T>(assoc: T) {
  for (const key in assoc)
    if (assoc[key] === undefined)
      delete assoc[key]

  return assoc
}

type Deep<depth extends number, D extends Dict> = depth extends 0
? D
: {[k in keyof D]: D[k] extends Dict ? Deep<Dec<depth>, D[k]> : D[k]}[keyof D]

function* iterateRecursive<d extends number, S extends Dict>(depth: d, store: S, destroy?: boolean): Generator<Deep<d, S>> {
  if (depth <= 0) {
    //@ts-expect-error
    yield store
    return 
  }

  for (const s in store) {
    const v = store[s]

    if (destroy && v !== null && typeof v === "object")
      delete store[s]

    if (depth === 1 || v === null || typeof v !== "object")
      //@ts-expect-error
      yield v as T
    else
      //@ts-expect-error
      yield* iterateRecursive(depth - 1, v, destroy)
  }
}

function pushToGroup<T, Acc = T>(
  store: Dict,
  groupId: Trajectories<T> | ((item: T) => primitive[]),
  // TODO <Acc = T> doesn't work here
  merge: (acc: null|WriteAble<Acc>, item: T) => WriteAble<Acc>,
  item: T
) {
  //@ts-ignore
  const keys = groupKey(groupId, item)
  , lastIndex = keys.length - 1

  let pointer = store as any
  
  for (let k = 0; k < lastIndex; k++) {
    const key = keys[k] as keyof typeof pointer
    pointer = pointer[key] ??= {}
  }

  const lastKey = keys[lastIndex] as keyof typeof pointer

  pointer[lastKey] = merge(pointer[lastKey], item)
  
  return store
}

function getDeep<S,
  D extends string = "."
>(
  source: S,
  traj: string|readonly string[],
  //@ts-expect-error
  delimiter: D & string = "."
) {
  const length = !$isArray(traj) ? undefined : traj.length
  , parser = length !== undefined ? undefined
  : new RegExp(`([^${delimiter}]+)(${
    delimiter === "." ? "\\"
    : ""
  }${delimiter}|$)`, "y")

  let i = 0

  const next = length !== undefined
  ? () => i >= length ? undefined : traj[i++]
  : () => 
    // parser!.exec(traj as string)?.[1]
    (traj as string).match(parser!)?.[1]
    // parser!.exec(traj as string)?.[1]

  let pointer = source

  for (;;) {
    if (pointer === null || typeof pointer !== "object")
      break

    const key = next()
     
    if (key === undefined)
      break

    pointer = (pointer as any)[key]
  }

  return pointer
}

function accumulatorProducer<
  Ops extends Dict<(acc: any, item: any) => any>
>(ops: Ops & {[o in keyof Ops]: (acc: undefined|ReturnType<Ops[o]>, item: Arg1<Ops[o]>) => ReturnType<Ops[o]>}) {
  return function accumulator<
    I extends {[k in string]: keyof Ops},
    T extends {[k in keyof I]?: unknown},
    A extends {[k in keyof I]?: ReturnType<Ops[I[k]]>},    
  >(instruction: I, accumulator: falsy|A, item: T) {      
    const acc = accumulator || {} as A

    for (let key in instruction)
      acc[key] = ops[instruction[key]]?.(acc[key], item[key])
    
    return acc
  }
}

function groupKey<T>(
  groupId: Leaves<T> | Trajectories<T> | ((item: T) => primitive[]),
  item: T
) {
  let keys: primitive[]
  
  if (typeof groupId === "function")
    //@ts-expect-error
    keys = groupId(item)
  else {
    // TODO Segregate to `getTuple`
    //@ts-expect-error
    const {length} = groupId

    keys = []
    
    for (let t = 0; t < length; t++)
      //@ts-expect-error Uff
      keys[t] = getDeep(item, groupId[t])
  }

  return keys
}

function tryValues(source: Dict, args: readonly any[]) {
  const {length} = args

  let noKeys = true

  for (let a = 0; a < length; a++) {
    const arg = args[a]

    if (typeof arg === "string" && arg in source) {
      noKeys = false
      break
    }
  }
    
  if (noKeys)
    return args

  const vals: any[] = []

  for (let a = 0; a < length; a++) {
    const arg = args[a]
    vals[a] = typeof arg === "string" && arg in source
    ? source[arg]
    : arg
  }

  return vals
}