import { sortKeysAsc } from "./assoc"
import { fixed } from "./math"
import type { Arg0, Arg1, Arg2 } from "./ts-utils.types"

export {
  reparse,
  jsonStringify,
  defaultReviver
}

const {isArray: $isArray} = Array

/** @deprecated Tests only */
function reparse<S>(source: S, reviver: typeof defaultReviver = defaultReviver, params?: Arg2<typeof defaultReviver>): S {
  return JSON.parse(jsonStringify(source, 0), (v, k) => reviver(v, k, params))
}

function jsonStringify(source: any, indent = 2, reviver = sortOnlyObjects) {
  return JSON.stringify(source, reviver, indent)
}

function sortOnlyObjects(_: any, v: any) {
  if (v && typeof v.toJSON === "function")
    v = v.toJSON()

  if (!v || typeof v !== "object" || Array.isArray(v))
    return v

  const sorted = sortKeysAsc(v)

  return sorted
}

const defaultRawFields = new Set([
  "timestamp",
  "minimum",
  "maximum",
])

function defaultReviver<T extends Arg1<JSON["parse"]>>(k: Arg0<JSON["parse"]>, v: T, {
  digits = 10,
  fieldsAsRaw = defaultRawFields as undefined|Set<string>|string[]
} = {}) {
  if (fieldsAsRaw) {
    if (
      $isArray(fieldsAsRaw) ? fieldsAsRaw.includes(k)
      : fieldsAsRaw.has(k)
    )
      return v
  }


  if (typeof v === "number")
    return fixed(v, digits)

  if (v && typeof v === "object") {
   if ($isArray(v)) {
      const arr = v as any[]
      if (arr.length) {
        const first = v[0]
        
        return first && typeof first === "object"
        ? arr
        : arr.sort()
      }  
    } else
      //@ts-expect-error
      v = sortKeysAsc(v.toJSON?.() || v)
  }

  return v
}