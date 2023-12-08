import type { AnyObject } from "./ts-utils.types"

export { }

function map2Json(this: Map<any, any>) {
  const obj: AnyObject = {}
  
  this.forEach((v, k) => obj[k] = v)

  return obj
}

//@ts-expect-error
Map.prototype.toJSON = map2Json