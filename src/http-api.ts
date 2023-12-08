import type { Headers } from "node-fetch"
import { deleteUndefined } from "./assoc"
import { fetch } from "./fetch"
import {
  prop2httpMethod,
  prop2httpUri,
  RestEntityDesc,
  RestJoinDesc,
  RestMethod,
  RestSubEntityDesc,
  RestSubInterface,
  type RestInterface
} from "./rest"
import type {
  Arg0,
  EmptyObject,
  OmitStrict,
  Return
} from "./ts-utils.types"

export {
  createHttpApi
}

function createHttpApi<
  Entity extends RestEntityDesc,
  SubEntity extends RestSubEntityDesc = EmptyObject,
  Join extends RestJoinDesc = EmptyObject
>({
  base,
  entity,
  headers,
  idKey,
  subEntity,
  subKey
}: {
  "base": string
  "entity": string
  headers?: () => Promise<Headers>,
  "idKey": string 
  "subEntity"?: string
  "subKey"?: string
}, fetchOpts?: OmitStrict<Arg0<typeof fetch>, "base"|"headers"|"url"|"method"|"query"|"data">) {
  type Rest = RestInterface<
    EmptyObject,
    Entity,
    SubEntity,
    Join
  >
  & RestSubInterface<
    EmptyObject,
    Entity,
    SubEntity,
    Join
  >

  const client: Rest = new Proxy({} as Rest, {
    get<M extends RestMethod>(target: Rest, prop: M) {

      //@ts-expect-error
      return target[prop] ??= async (arg: Arg0<typeof target[M]>) => {        
        const method = prop2httpMethod(prop) || prop
        , id = arg[idKey]
        //@ts-expect-error
        , subId = arg[subKey]
        , payload = deleteUndefined({
          ...arg,
          [idKey]: undefined,
          [subId]: undefined
        })
        , res = await fetch({
          ...fetchOpts,
          base,
          "headers": await headers?.(),
          "url": prop2httpUri(prop, entity, id, subEntity, subId),
          method,
          [method === "GET" ? "query" : "data"]: payload
        })

        return res.data as Return<typeof target[M]>
      }
    }
  })

  return client
}
