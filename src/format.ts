import type { Arg1, Dict } from "./ts-utils.types";

export {
  getAllPaths, json2csvIter,
  json2values
};

const {isArray: $isArray} = Array

const jsonStringify = (v: any) => JSON.stringify(v)

async function* json2csvIter<T extends Dict>(
  items: AsyncIterable<T> | Iterable<T>,
  params = {} as Partial<{
    /** CommaSV `"",""`, TabSV `"\t"` */
    "delimiter": string,
  }> & Arg1<typeof json2values>,
) {
  params.headers ??= []
  params.collectHeaders = params.collectHeaders || params.headers.length === 0

  const {delimiter = ","} = params
  
  for await (const item of items)
    yield json2values(item, params).join(delimiter)
}

function json2values<T extends Dict>(
  item: T,
  {
    collectHeaders,
    headers = [],
    onObject = jsonStringify
  } = {} as Partial<{
    /** If no explicit - auto-collected. Paths is `.` separated */
    "headers": string[]
    "onObject": (value: any, path: string[]) => string
    "collectHeaders": boolean
  }>,
) {
  collectHeaders = collectHeaders || headers.length === 0
  
  const collected = collectHeaders ? new Set(headers) : undefined
  , row: string[] = []

  if (collectHeaders) {
    for (const path of getAllPaths(item))
      if (!collected!.has(path)) {
        collected!.add(path)
        headers.push(path)
      }
  }

  const {length} = headers
  chunks: for (let h = 0; h < length; h++) {
    const path = headers[h].split(".")
    , {length} = path

    let pointer: any = item

    for (let p = 0; p < length; p++) {
      const key = path[p]

      if (pointer === null || typeof pointer !== "object") {
        row.push("")

        continue chunks
      }

      pointer = pointer[key]
    }

    row.push(
      pointer === undefined ? ""
      : pointer === null || typeof pointer !== "object" ? `${pointer}`
      : onObject(pointer, path)
    )       
  }

  return row
}

function* getAllPaths(source: Dict, base = "", delimiter = "."): Iterable<string> {
  const midfix = base === "" ? "" : "."

  for (const key in source) {
    const value = source[key]
    , subpath = `${base}${midfix}${key}`

    if (value === "null" || $isArray(value) || typeof value !== "object")
      yield subpath
    else
      yield* getAllPaths(value as Dict, subpath, delimiter)
  }
}