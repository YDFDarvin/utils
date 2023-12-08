import { ObjectId } from "mongodb"
import { reparse } from "./json"

export {
  dump2data
}

function dump2data<R>(items: unknown[]): R[] {
  //@ts-expect-error
  return items.map(item => reparse(item, (_, v) =>
    v === null || typeof v !== "object" ? v
    //@ts-ignore
    : "$oid" in v ? new ObjectId(v.$oid)
    //@ts-ignore
    : "$date" in v ? new Date(v.$date)
    : v
  ))
}
