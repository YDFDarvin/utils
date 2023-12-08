import nodeFetch from "node-fetch"
import { stringify } from "qs"
import { isEmptyObject } from "./assoc"
import type {
  Arg1,
  primitive
} from "./ts-utils.types"

const {stringify: $stringify, parse} = JSON

export {
  fetch
}

function fetch<P, R>(params: Omit<NonNullable<Arg1<typeof nodeFetch>>, "body"|"signal"> & {
  "base"?: string
  "url": string
} & Partial<{
  "query": Record<string, primitive|primitive[]>
  "timeout": number
  "data": P
}>) {
  const {
    base = "",
    url,
    timeout,
    data,
    query
  } = params
  , controller = timeout ? new AbortController() : undefined
  , timeoutId = controller && setTimeout(() => controller.abort(), timeout)
  , search = query && stringify(query)
  
  let fetching = nodeFetch(`${base}${url}${
    !search ? "" : `?${search}`
  }`, {
    ...params,
    "headers": {
      ...params.headers,
      ...data && {"Content-Type": "application/json"}
    },
    ...data && !isEmptyObject(data) && {"body": $stringify(data)},
    //@ts-ignore
    "signal": controller?.signal ?? null
  })
  .then(async r => {
    const {
      ok,
      redirected,
      // timeout,
      // type,
      status,
      statusText,
    } = r
    , response = {
      ok,
      redirected,
      // timeout,
      // type,
      status,
      statusText,
      headers: {} as Record<string, string>,
      "data": undefined as unknown as R
    }
    , { headers } = response
    , text = await r.text()
    
    try {
      response.data = parse(text)
    } catch (_) {
      //@ts-expect-error
      response.text = text
    }

    r.headers.forEach((v, n) => headers[n] = v)

    return response
  })
  .catch(e => ({
    "ok": false,
    "status": -1,
    "statusText": e.message,
    "data": e
  }))
  
  return !timeoutId ? fetching
  : fetching.finally(() => clearTimeout(timeoutId))
}