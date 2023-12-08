import type { FindCursor } from "mongodb";
import { fill } from "./array";
import { parallel } from "./async";
import type { Arg1 } from "./ts-utils.types";

export {
  findParallel,
  findParallelArrs,
  clusterizeCursor
};

const {ceil, min} = Math

async function findParallelArrs<T, R = T>(
  cursor: FindCursor<T>,
  params: Arg1<typeof clusterizeCursor>,
  map?: (item: T) => R,
  // TODO Consider forEach. With `thenEach` there's TS issue in type inheritance
) {
  const cursors = await clusterizeCursor(cursor, params)

  return await Promise.all(cursors.map(c => 
    (map ? c.map(map) : c as unknown as FindCursor<R>)
    .toArray()
  ))
}

/** @deprecated */
async function* findParallel<T>(
  cursor: FindCursor<T>,
  params: Arg1<typeof clusterizeCursor>
) {
  const cursors = await clusterizeCursor(cursor, params)

  try {
    yield* parallel(cursors)
  } catch (_) {}

  await Promise.all(cursors.map(c => c.close()))
}

async function clusterizeCursor<T>(
  cursor: FindCursor<T>,
  {
    streams,
    maxCount = Infinity,
    maxTotalCount,
    count
  }: {
    /** More is faster, but less than liner in [20, 100]. 50 is totally ok, even 20 is enough */
    "streams": number
    "maxCount"?: number
    "maxTotalCount"?: number
    /** Hint value. Otherwise, `cursor.count()` will be launched */
    "count"?: number
  }
) {
  let countCursor = cursor.clone()

  if (maxTotalCount)
    countCursor = countCursor.limit(maxTotalCount + 1)

  count || (count = await countCursor.count())
  
  await countCursor.close()
  
  if (maxTotalCount && count > maxTotalCount)
    throw Error("413 Payload Too Large")

  const step = min(ceil(count / streams), maxCount)
  , streamsCount = ceil(count / step)
  , cursors = fill(streamsCount, i => {
    let c = cursor.clone()
    .skip(i * step)

    if (i + 1 !== streamsCount)
      c = c.limit(step)

    return c
  })

  await cursor.close()

  return cursors
}