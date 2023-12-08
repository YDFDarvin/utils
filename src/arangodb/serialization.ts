import type { ArangoBaseDocument } from "./db.types";
import type { ISearch } from "./repository.arango";

export { serializePipeline }

const { isArray: $isArray } = Array

function stageWrap(
  query: string,
  returnQuery: string,
  collection: string,
  stageCoords: { "depth": number; "stageIdx": number }
) {
  const { depth, stageIdx } = stageCoords
  , coordinates = serializeStageCoordinates(stageCoords)
  , prevCoordinates = serializeStageCoordinates({
    depth,
    "stageIdx": stageIdx === 0 ? stageIdx : stageIdx - 1
  })
  return `\n LET stage${coordinates} = (FOR doc${coordinates} IN ${
    stageIdx === 0 ? collection : `stage${prevCoordinates}`
  } ${query} ${returnQuery})`;
}

function serializePipeline<Query extends ArangoBaseDocument>(
  collection: string,
  pipeline: ISearch<Query>[],
  depth = 0
): string {
  const ctxIdx = pipeline.findIndex((p) => p && "$context" in p)
  let ctx = ""
  if (ctxIdx >= 0) {
    ctx = pipeline[ctxIdx].$context ?? "";
    // TODO as {pipeline: {0: {$filter}, 1: {$lookup}, 2: {$project}...}}
    pipeline = pipeline.filter((_, idx) => idx !== ctxIdx)
  }
  const query = `${ctx} ${pipeline.reduce(
    (acc, stage, stageIdx) => {
      const stageCoords = {depth, stageIdx}
      , pureQuery = serializeQuery<Query>(stage, stageCoords)
      , returnCoords = stage.$lookup
      ? {"depth": depth + 1, "stageIdx": buildStageIdx(stage)}
      : undefined
      , returnQuery = `${appendReturn2Query(stage, stageCoords, returnCoords)}`
      , serializedQuery = stageWrap(pureQuery, returnQuery, collection, stageCoords)
      return acc + serializedQuery
    },
    ""
  )} ${
    pipeline.length <= 1 || depth === 0
    ? `FOR elem IN stage_${depth}_${pipeline.length - 1} RETURN elem`
    : ""
  }`;

  return query;
}

function buildStageIdx<Query extends ArangoBaseDocument>(
  stage: ISearch<Query>
) {
  if (stage?.$lookup)
    return stage.$lookup.pipeline.length - 1 - (stage.$lookup.pipeline?.[0]?.$context ? 1 : 0)

  return 0;
}

function serializeStageCoordinates({
  depth,
  stageIdx,
}: {
  depth: number;
  stageIdx: number;
}) {
  return `_${depth}_${stageIdx}`
}

function replaceDocWithCoordinates(
  query: string,
  stageCoords: { depth: number; stageIdx: number }
) {
  const coordinates = serializeStageCoordinates(stageCoords);
  return query.replace(/doc\./g, `doc${coordinates}.`);
}

function serializeQuery<Query extends ArangoBaseDocument>(
  params: ISearch<Query>,
  stageCoords: {"depth": number; "stageIdx": number}
): string {
  const {
    $match,
    $limit,
    $sort,
    $skip,
    $filter,
    $lookup,
    $groupBy,
    $sample
  } = params
  , {depth} = stageCoords
  , coordinates = serializeStageCoordinates(stageCoords);

  let query = "";

  if ($sample) query += ` FILTER RAND() < ${$sample.chance} LIMIT ${$sample.skip}, ${$sample.size}`;

  if (!$filter && $match) query += appendMatch2Query(params, coordinates);
  else if ($filter) query += $filter.replace(/doc\./g, `doc${coordinates}.`);

  if ($sort) query += ` SORT ${$sort.replace(/doc\./g, `doc${coordinates}.`)} `;

  if ($limit) query += ` LIMIT ${$skip ? $skip + ", " : ""} ${$limit} `;

  if ($groupBy) query += ` COLLECT ${replaceDocWithCoordinates($groupBy, stageCoords)}`

  if ($lookup) {
    const { pipeline, from, foreignField, localField, "let": _let } = $lookup;
    if (_let) {
      let $context = ``;
      for (const allowed in _let)
        $context += ` LET ${allowed} = doc${coordinates}.${_let[allowed]}`;
      pipeline.unshift({ $context });
    }
    foreignField && localField && pipeline.unshift({
      "$filter": `
        LET __is_array = IS_ARRAY(doc${coordinates}.${localField})
        FILTER (
          __is_array AND doc.${foreignField} IN doc${coordinates}.${localField}
        ) OR (
          !__is_array AND doc.${foreignField} == doc${coordinates}.${localField}
        )
      `
    })

    query += `${serializePipeline(from, pipeline, depth + 1)}`;
  }

  return query;
}

function appendMatch2Query<Query extends ArangoBaseDocument>(
  { $match }: ISearch<Query>,
  coordinates: string
) {
  let query = "";
  for (const field in $match) {
    if (typeof $match[field] !== 'string' && !$isArray($match[field]))
      throw new Error(`Unsupported type of value: ${$match[field]}`);

    const value = $match[field]
    , sign = typeof value === 'string' ? '==' : 'IN'
    , serializedValue = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);

    query += `FILTER doc${coordinates}.${field} ${sign} ${serializedValue} `;
  }
  return (query += `FILTER doc${coordinates} != null`);
}

function appendReturn2Query<Query extends ArangoBaseDocument>(
  { $project, $lookup, $groupBy, $unwind, $count }: ISearch<Query>,
  stageCoords: {"depth": number; "stageIdx": number},
  mergeCoords?: {"depth": number; "stageIdx": number}
) {
  const coordinates = serializeStageCoordinates(stageCoords)
  , mergeCoordinates = mergeCoords && serializeStageCoordinates(mergeCoords);

  if ($count) return ` COLLECT WITH COUNT INTO ${$count} RETURN {${$count}: ${$count}}`

  if ($unwind) return ` FOR unwinded IN doc${coordinates}.${$unwind} RETURN unwinded`

  if ($project) {
    const projections: string[] = []
    for (const projected in $project) {
      const rawProjection = $project[projected]
      if (!rawProjection) continue;
      const projection = rawProjection === 1 ? `doc${coordinates}.${projected}`
      :  rawProjection.startsWith("$")
      ? `doc${coordinates}.${rawProjection.substring(1)}`
      : rawProjection.replace(/doc(_(\d+)_(\d+))?/g, `doc${coordinates}`);
      projections.push(`${projected}: ${projection}`);
    }
    $lookup && projections.push(`${$lookup.as}: ${stageCoords.depth > 0 ? `stage${mergeCoordinates}` : $lookup.as}`);
    return ` RETURN {${projections.join(", ")}}`
  }
  if ($lookup) return ` RETURN MERGE(doc${coordinates}, {${$lookup?.as}: stage${mergeCoordinates}})`

  if ($groupBy) return ` FOR elem IN ${
    $groupBy.replace(/.*INTO (\w+).*/, "$1")
  } RETURN elem.doc${coordinates}`;

  return ` RETURN doc${coordinates}`;
}