import { getDeep } from "./assoc";
import {
  $add,
  $addToSetLean,
  $allOf,
  $anyOf,
  $avg,
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
  $min,
  $multiply,
  $ne,
  $nin,
  $oneOf,
  $oneOrNull,
  $range,
  $sum
} from "./group-ops";
import type {
  AnyReadonlyObject,
  Arg1,
  Paths
} from "./ts-utils.types";

export {
  condEntry,
  logicalOperate,
  matchConditions,
  valueAggregate,
  valueOperate,
  type AggregationOperator,
  type ConditionEntry,
  type LogicalOperator,
  type ValueCondition,
  type ValueOperator
};

type LogicalOperator = keyof typeof logicalOperator;
type ValueCondition = keyof typeof valueCondition;
type ValueOperator = keyof typeof valueOperator;
type AggregationOperator = keyof typeof valueAggregator;

const valueCondition = {
  $eq,
  $gt,
  $gte,
  $in,
  $lt,
  $lte,
  $ne,
  $nin,
} as const
, valueAggregator = {
  $addToSetLean,
  $count,
  $first,
  $last,
  $max,
  $min,
  $nin,
  $oneOrNull,
  $range,
  $sum,
  $avg
} as const
, valueOperator = {
  $divide,
  $multiply,
  $sum,
  $add
}
, logicalOperator = {
  $allOf,
  $anyOf,
  $oneOf
} as const

function valueOperate(op: keyof typeof valueOperator, args: readonly any[]) {
  //@ts-ignore
  return valueOperator[op]
  .apply(undefined,
    //@ts-ignore
    args
  )
}

function valueAggregate<Op extends keyof typeof valueAggregator>(op: Op): typeof valueAggregator[Op]
function valueAggregate<Op extends keyof typeof valueAggregator>(op: Op,
  ...args: Parameters<typeof valueAggregator[Op]>
): ReturnType<typeof valueAggregator[Op]>
function valueAggregate<Op extends keyof typeof valueAggregator>(op: Op) {
  const fn = valueAggregator[op]

  return arguments.length === 1 ? fn
  //@ts-expect-error
  : fn.call(...arguments)
  // TODO also an option
  // : fn.apply(null, (
  //   Array.prototype.shift.call(arguments),
  //   arguments
  // ))
}

function logicalOperate<Op extends keyof typeof logicalOperator>(op: Op): typeof logicalOperator[Op]
function logicalOperate<Op extends keyof typeof logicalOperator>(op: Op,
  ...args: Parameters<typeof logicalOperator[Op]>
): ReturnType<typeof logicalOperator[Op]>
function logicalOperate<Op extends keyof typeof logicalOperator>(op: Op) {
  const fn = logicalOperator[op]

  return arguments.length === 1 ? fn
  //@ts-expect-error
  : fn.call(...arguments)
  // TODO also an option
  // : fn.apply(null, (
  //   Array.prototype.shift.call(arguments),
  //   arguments
  // ))
}

type ConditionEntry = {[op in ValueCondition]: {
  "op": op
  "value": Arg1<typeof valueCondition[op]>
}}[ValueCondition]

function condEntry(probe: any, conditions: readonly ConditionEntry[]) {
  for (let c = conditions.length; c-->0;) {
    const {
      op,
      value
    } = conditions[c]
    , validatorFn = valueCondition[op];

    if (!validatorFn(probe, value))
      return false;
  }

  return true;
}

function matchConditions<T extends AnyReadonlyObject>(source: T, $match: {
  //@ts-ignore
  [k in Paths<T>]: {[op in ValueCondition]?: Arg1<typeof valueCondition[op]>}
}) {
  for (const path in $match) {
    const value = getDeep(source, path)
    , expr = $match[path as keyof typeof $match]

    for (const op in expr)
      if (!valueCondition[
        op as ValueCondition
      ](
        value,
        expr[op as keyof typeof expr]
      ))
        return false
  }

  return true
}