import { firstValue, isEmptyObject } from "./assoc";
import type {
  AnyObject,
  DeepValues,
  Dict,
  EmptyObject,
  Fn,
  Lens,
  Nullable, ProjectionStrict, ProjectStrict, ProjectWithPropsStrict, WriteAble
} from "./ts-utils.types";

export {
  EMPTY_OBJECT, append,
  deepClone,
  deepTraverse,
  definingProperties,
  entrize,
  forIn,
  isObject,
  lens,
  pick,
  project,
  projectionIncludes,
  transpose
};

const {isArray: $isArray} = Array
, {getPrototypeOf: $getPrototypeOf, defineProperty: $defineProperty} = Object
, EMPTY_OBJECT = Object.freeze({})

function forIn<S extends Dict, F extends (value: S[keyof S], key: keyof S) => any>(
  source: Nullable<S>,
  fn: F,
  target = {} as Record<keyof S, ReturnType<F>>
) {
  if (!source)
    return target

  for (const key in source) {
    const value = fn(source[key], key)

    if (value !== undefined)
      target[key] = value
    else if (target === source)
      delete target[key]
  }

  return target
}

function transpose<S extends Dict, R extends string>(source: S, getter: (item: S[keyof S]) => R) {
  const transposed = {} as Record<R, keyof S>

  for (const key in source)
    transposed[getter(source[key])] = key

  return transposed
}

/** Doesn't work good */
type Trajectory<T, Acc extends (undefined|string)[] = []>
= [Exclude<T, null|undefined|boolean|number|symbol|bigint|any[]|Fn>] extends [never]
? Acc
: Trajectory<
  Exclude<T, null|undefined|boolean|number|symbol|bigint|any[]|Fn>[Extract<keyof Exclude<T, null|undefined|boolean|number|symbol|bigint|any[]|Fn>, string>],
  [...Acc, (Extract<keyof Exclude<T, null|undefined|boolean|number|symbol|bigint|any[]|Fn>, string>)?]
>

/** Bad ts */
function lens<S, T extends Readonly<Trajectory<S>>>(
  store: S,
  trajectory: Readonly<T & string[]>,
  // TODO undefined/optional assign means `get`
  assign: unknown
): Lens<S, T & string[]> {
  const {length} = trajectory as string[]

  let pointer = store

  for (let p = 0; p < length; p++) {
    const key = trajectory[p]

    //@ts-ignore
    let nextPointer = pointer[key]

    if (nextPointer === undefined)
      //@ts-ignore
      nextPointer = pointer[key] = (
        p === length - 1
        ? assign
        : {}
      )

    pointer = nextPointer
  }

  //@ts-expect-error
  return pointer
}

/** Multi-dimensional dict to multi-dimensional array. Opposite to `dictize` */
function entrize<S, D extends number>(source: S, depth: D, withKV: boolean) {
  const $return: DeepValues<S, D>[] = []
  , nextDepth = depth - 1
  , last = nextDepth <= 0

  for (const k in source) {
    const value = source[k]
    , v = last ? value : entrize(value, nextDepth, withKV)

    //@ts-expect-error
    $return.push(withKV ? {
      k,
      v
    } : v)
  }

  return $return
}

function projectionIncludes<P extends Dict>(projection: Nullable<ProjectStrict<P>>, key: keyof P) {
  if (!projection || isEmptyObject(projection))
    return true

  const p = projection[key]

  if (p === undefined)
    return firstValue(projection) == 0
    
  return p == 1
}

function project<S>(source: S, projection: Nullable<EmptyObject>): S
function project<S extends AnyObject, P extends ProjectWithPropsStrict<S>>(
  sources: S,
  projection: P & {[k in Exclude<keyof P, keyof S>]?: keyof S}
): ProjectionStrict<S, P>
function project<S extends AnyObject, P extends ProjectWithPropsStrict<S>>(
  source: S,
  projection: Nullable<P & {[k in Exclude<keyof P, keyof S>]?: keyof S}>
) {
  if (!projection || isEmptyObject(projection))
    return source
    
  const result = source as unknown as ProjectionStrict<S, P>
  , sign = firstValue(projection)
  , isPickNotOmit = sign !== 0

  if (isPickNotOmit) {
    for (const key in projection) {
      //@ts-ignore
      const projV = projection[key]

      if (projV === 1)
        continue

      if (projV in source)
      //@ts-expect-error
        source[key] = source[projV]
    }

    for (const key in source)
      if (!(key in projection))
        //@ts-expect-error
        delete result[key]
  } else {
    for (const key in projection)
      if (key in source)
        //@ts-ignore
        delete result[key]
  }

  return result
}

function pick<S, K extends Extract<keyof S, string>>(source: Readonly<S>, keys: readonly K[]) {
  const result = {} as Pick<S, K>
  , {length} = keys

  for (let k = 0; k < length; k++) {
    const key = keys[k]
    , value = source[key]

    if (value != undefined)
      result[key] = source[key]
  }

  return result
}

function append<S extends AnyObject, P extends {[k in keyof S]?: S[k]}>(source: S, update: P) {
  for (const k in update)
    if (!(k in source))
      //@ts-ignore
      source[k] = update[k]
  
  return source as S & WriteAble<P>
}

function isObject<S>(source: S) {
  return source !== null && typeof source === "object" && !$isArray(source);
}

function deepTraverse(source: Dict, cb: (arg: Dict) => Dict | void) {
  if (source !== null && typeof source === "object")
    for (const s in source) {
      cb(source[s] as Dict);
      deepTraverse(source[s] as Dict, cb);
    }
}
    
function deepClone<T>(source: T) {
  const clone = {...source}

  for (const c in source) {
    const v = source[c]

    if (v === null || typeof v !== "object" || $getPrototypeOf(v).constructor !== Object)
      continue

    clone[c] = deepClone(v)
  }

  return clone
}

function definingProperties<S extends Dict>(source: S, props: Array<keyof S>, commonDesc: PropertyDescriptor) {
  for (let p = props.length; p-->0;) {
    const prop = props[p]

    if (!(prop in source))
      continue

    $defineProperty(source, prop, {
      "value": source[prop],
      ...commonDesc,
    })
  }

  return source
}
