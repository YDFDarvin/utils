import type { falsy } from "./ts-utils.types";
import type { OrMinMax } from "./utils";

export {
  $add,
  $addToSetLean,
  $allOf,
  $anyOf,
  $count,
  $divide,
  $eq,
  $first,
  $gt,
  $gte,
  $in,
  $last,
  $lt,
  $lte,
  $max,
  $concatArrays,
  $min,
  $multiply,
  $ne,
  $nin,
  $oneOf,
  $oneOrNull,
  $range,
  $sum,
  $avg,
  newAvg
};

const {isArray: $isArray} = Array

const $add = $sum

function $range<V extends string | number>(
  desc: undefined|null|OrMinMax<V>,
  nextValue: undefined|null|OrMinMax<V>
): OrMinMax<V> {
  if (desc === undefined || desc === null)
    return nextValue!
  if (nextValue === undefined || nextValue === null)
    return desc!
  if (desc === nextValue)
    return desc

  const {
    "minimum": descMin,
    "maximum": descMax
  } = typeof desc === "object" ? desc
  : {"minimum": desc as V, "maximum": desc as V}
  , {
    "minimum": nextMin,
    "maximum": nextMax
  } = typeof nextValue === "object" ? nextValue
  : {"minimum": nextValue as V, "maximum": nextValue as V}
  , minimum = descMin < nextMin ? descMin : nextMin
  , maximum = descMax > nextMax ? descMax: nextMax

  return minimum === maximum
  ? minimum
  : {
    minimum,
    maximum
  }
}

function $addToSetLean<T>(acc: T | Set<T>, item: T) {
  if (item === undefined)
    return acc

  if (acc === undefined)
    return item
    
  if (acc === null || acc === item)
    return acc

  //@ts-expect-error `OneOf2` doesn't work here
  return typeof acc?.add === "function"
  ? (acc as Set<T>).add(item)
  : new Set<T>().add(acc as T).add(item)
}

function $oneOrNull<T>(acc: null|T, item: T) {
  if (item === undefined)
  return acc

if (acc === undefined)
  return item
  
  return acc === item ? acc : null
}

function $divide(v1: number, v2: number): number
function $divide(v1: bigint, v2: bigint): bigint
function $divide(v1: undefined, v2: any): undefined
function $divide(v1: any, v2: undefined): undefined
function $divide(v1: any, v2: any): any {
  return v1 === undefined || v2 === undefined ? undefined 
  : v1 / v2
}

function $avg(acc: undefined|number|Avg, ...vs: (undefined|number|Avg)[]): number|Avg
function $avg() {
  const {length} = arguments
  , first = arguments[0]
  
  if (length < 2)
    return first
  
  if (!first || typeof first !== "object") {
    const acc = newAvg()
    acc.add(arguments)

    return acc
  } else {
    delete arguments[0]
    first.add(arguments)

    return first
  }
}

function $sum(acc: undefined|number, ...vs: (undefined|number)[]): undefined|number
function $sum(acc: undefined|bigint, ...vs: (undefined|bigint)[]): undefined|bigint
function $sum(acc: undefined|string, ...vs: (undefined|string)[]): undefined|string
function $sum() {
  const {length} = arguments
  
  let acc = arguments[0]

  for (let a = 1; a < length; a++) {
    const value = arguments[a]

    if (value === undefined)
      continue

    if (acc === undefined) {
      acc = value
      continue
    }

    acc += value
  }

  return acc
}

function $multiply(v1: undefined|number, ...vs: (undefined|number)[]): number
function $multiply(v1: undefined|bigint, ...vs: (undefined|bigint)[]): bigint
function $multiply(): any {
  const {length} = arguments

  let acc = arguments[0]

  for (let a = 1; a < length; a++) {
    const value = arguments[a]

    if (value === undefined)
      continue

    if (acc === undefined) {
      acc = value
      continue
    }

    acc *= value
  }

  return acc
}

function $first<T>(...args: T[]): T
function $first() {
  const {length} = arguments

  for (let a = 0; a < length; a++) {
    const value = arguments[a]

    if (value !== undefined)
      return value
  }
}

function $last<T>(...args: T[]): T
function $last() {
  const {length} = arguments

  for (let a = length; a-->0;) {
    const value = arguments[a]

    if (value !== undefined)
      return value
  }
}

function $count(acc: undefined|number, ..._: any[]): number {
  return (acc || 0) + 1;
}

function $max<T>(...args: T[]): T
function $max() {
  const {length} = arguments

  let acc

  for (let a = 0; a < length; a++) {
    const value = arguments[a]

    if (value === undefined)
      continue

    if (acc === undefined) {
      acc = value
      continue
    }

    if (acc < value)
      acc = value
  }

  return acc
}

function $concatArrays<T>(..._args: T[]): (Extract<T, any[]>[number] | Exclude<T, any>)[] {
  const {length} = arguments
  , first = arguments[0]

  if (!first && length <= 1)
    return first

  const acc = []
  
  for (let a = 0; a < length; a++) {
    const value = arguments[a] as T[]

    if (value !== undefined) {
      if (!$isArray(value))
        acc.push(value)
      else {
        const {length} = value

        if (length)
          for (let v = 0; v < length; v++) {
            const val = value[v]

            if (val !== undefined)
              acc.push(value[v])
          }
            
      }
    }
  }

  //@ts-expect-error
  return acc.length ? acc : undefined;
}

function $min<T>(...args: T[]): T
function $min() {
  const {length} = arguments

  let acc

  for (let a = 0; a < length; a++) {
    const value = arguments[a]

    if (value === undefined)
      continue

    if (acc === undefined) {
      acc = value
      continue
    }

    if (acc > value)
      acc = value
  }

  return acc
}


function $allOf(acc: undefined|boolean, ...values: (undefined|boolean)[]): boolean
function $allOf() {
  let result

  const {length} = arguments
  for (let a = 0; a < length; a++) {
    const arg = arguments[a]
    result = result === undefined ? arg
    : arg === undefined ? result
    : result && arg

    if (result !== undefined && !result)
      return false
  }

  return result === undefined ? true : result
}

function $anyOf(acc: undefined|boolean, ...values: (undefined|boolean)[]): boolean
function $anyOf() {
  let result

  const {length} = arguments
  for (let a = 0; a < length; a++) {
    const arg = arguments[a]
    result = result === undefined ? arg
    : arg === undefined ? result
    : result || arg

    if (result === true)
      return true
  }

  return result === undefined ? true : result
}


function $oneOf(acc: undefined|boolean, ...values: (undefined|boolean)[]): boolean
function $oneOf() {
  let result: undefined | boolean

  const {length} = arguments
  for (let a = 0; a < length; a++) {
    const arg = arguments[a]

    if (arg !== true)
      continue

    result = result !== true

    if (result === false)
      return false
  }

  return result === undefined ? false : result
}

function $eq<T>(probe: T|T[], value: T) {
  if (!$isArray(probe))
    return probe == value;

  for (let p = probe.length; p-->0;)
    if (probe[p] == value)
      return true

  return false
}

function $ne<T>(probe: T, value: T) {
  return !$eq(probe, value)
}

function $gt<T>(propertyValue: T, value: T) {
  return propertyValue > value;
}

function $lt<T>(propertyValue: T, value: T) {
  return propertyValue < value;
}

function $gte<T>(propertyValue: T, value: T) {
  return propertyValue >= value;
}

function $lte<T>(propertyValue: T, value: T) {
  return propertyValue <= value;
}

function $in<T>(probe: T|T[], value: readonly T[]) {
  if (!$isArray(probe))
    return value.includes(probe)

  for (let p = probe.length; p-->0;)
    if (value.includes(probe[p]))
      return true

  return false
}

function $nin<T>(probe: T, value: readonly T[]) {
  return !$in(probe, value)
}


type Avg<T = number> = T & {add(x: ArrayLike<T|Avg<T>|falsy>): T|Avg<T>}
function newAvg() {
  let sum: undefined|number = undefined
  , count: undefined|number = undefined

  function add<T extends number|bigint>(arr: ArrayLike<falsy|T|Avg<T>>): T|Avg<T> {
    for (let a = arr.length; a-->0;) {
      const value = arr[a]
      
      if (typeof value === "number") {
        if (count === undefined)
          count = 0

        count++
        
        sum = sum === undefined ? value
        : sum + value
      } else if (value && typeof value === "object") {
        const {_sum, _count} = value

        if (typeof _count === "number"
          && (typeof _sum === "number")
        ) {
          count = count === undefined ? _count
          : count + _count

          sum = sum === undefined ? _sum
          : sum + _sum
        } else {
          if (count === undefined)
            count = 0

          count++

          sum = sum === undefined ? value
          : sum + value
        }
      }
    }

    //@ts-expect-error
    return !count ? undefined : sum / count
  }

  function valueOf() {
    //@ts-expect-error
    return sum / count 
  }

  return new Proxy({} as Avg, {
    get(_, prop) {
      if (prop === "add")
        return add

      switch (prop) {
        case "toBSON":
        case "valueOf":
        case "toString":
        case "toJSON":
        case Symbol.toPrimitive:
          return valueOf

        case "_count": return count
        case "_sum": return sum

        default: {
          const v = valueOf()
          //@ts-expect-error Jest stuff appears here
          return v && function() {return v[prop]?.(...arguments)}
        }
      }
    }
  })
}
