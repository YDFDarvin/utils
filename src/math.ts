import type { falsy, Nullable } from "./ts-utils.types"

const {
  round: $round,
  ceil: $ceil
} = Math

export {
  round,
  ceil,
  minmax,
  min,
  max,
  fixed,
  sum
}

function round(x: number, unit: Nullable<number>) {
  return !unit ? x : $round(x * unit) / unit
}

function ceil(x: number, unit: Nullable<number>, epsilon: number) {
	return !unit ? x : $ceil((x  - epsilon) * unit) / unit
}

function minmax(x: number, min: number, max: number) {
  return x < min ? min
  : x > max ? max
  : x    
}

function min<T>(...args: T[]): Extract<T, number>
function min(): any {
  //@ts-ignore
  let min: Extract<T, number> = undefined

  for (let a = arguments.length; a-->0;) {
    const v = arguments[a]

    if (typeof v === "number" && !isNaN(v)  && (min === undefined || min > v))
      //@ts-ignore
      min = v
  }

  return min
}

function max<T>(...args: T[]): Extract<T, number>
function max(): any {
  //@ts-ignore
  let max: Extract<T, number> = undefined

  for (let a = arguments.length; a-->0;) {
    const v = arguments[a]

    if (typeof v === "number" && !isNaN(v)  && (max === undefined || max < v))
      //@ts-ignore
      max = v
  }

  return max
}

/** @deprecated use `$sum` */
function sum(items: (falsy|number)[]): number {
  const {length} = items
  let sum: number = 0
  , i = 0

  for (; i < length; i++) {
    const item = items[i]
    if (item) {
      sum = item
      break
    }
  }

  i++

  for (; i < length; i++) {
    const item = items[i]

    if (item)
      sum += item
  }

  return sum
}

function fixed(v: number, fixed: number) {
  if (!v)
    return v

  const abs = v > 0 ? v : -v
  , digits = Math.ceil(Math.log10(abs))

  if (v % 1 === 0 && digits <= fixed)
    return v

  if (fixed >= `${v}`.length - 1 - (v > 0 ? 0 : 1))
    return v

  if (abs < 1) {
    const patternDigits = `^(-?0\\.0*)([0-9]{0,${fixed}})[0-9]*$`
    , patternExponential = `^(-?[0-9]\\.[0-9]{0,${fixed - 1}})[0-9]*(e.*)$`
    , str = `${v}`.replace(new RegExp(`${patternDigits}|${patternExponential}`), "$1$2$3$4")

    return +str
  }

  if (digits <= fixed) {
    let rounded = round(v, 10**(fixed - digits))

    if (rounded % 1)
      rounded = + `${rounded}`.substring(0, fixed + 1)
    
    return rounded
  }

  const bigint = BigInt(
    v % 1 === 0 ? v : Math.ceil(v)
  )
  , str = bigint.toString()
  .replace(new RegExp(`^(.{${fixed}})(.*)$`)
    , (_, p1, p2) => `${
    p1
  }${
    "0".repeat(p2.length)
  }`)

  return +str
}