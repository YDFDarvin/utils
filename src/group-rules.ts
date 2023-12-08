import {
    getDeep,
    groupKey,
    isEmptyObject,
    tryValues
} from "./assoc";
import type ruleResponseSchema from "./group-rule-result.schema.json";
import type ruleSchema from "./group-rule.schema.json";
import {
    condEntry,
    logicalOperate,
    valueAggregate,
    valueOperate,
    ValueOperator,
    type AggregationOperator,
    type ConditionEntry,
    type LogicalOperator
} from "./grouping";
import { forIn } from "./object";
import type {
    Arg0,
    Dict,
    falsy,
    Id,
    Leaves,
    Schema2Ts
} from "./ts-utils.types";

export {
    RuleValidator,
    createRuleValidator,
    validateRules,
    type Rule,
    type ValidationResult,
    type RuleSchema,
    type RuleResultSchema,
    validateTrigger
};

type RuleResultSchema = Schema2Ts<typeof ruleResponseSchema>
type RuleSchema = Schema2Ts<typeof ruleSchema>
type Aggregated = {
    [key in GroupKey]: Dict[]
}

type RuleValidatorInterface<T, K extends string = string> = {
    push(item: T): void
    validateRules(): undefined|{[k in K]: ValidationResult}
}

type GroupKey = Id<"groupKey">

const GROUP_DELIMITER = " "
, blankValidator = {
    push() {return undefined},
    validateRules() {return undefined}
} satisfies RuleValidatorInterface<any, any>

class RuleValidator<T, K extends string = string> implements RuleValidatorInterface<T, K> {
    ruleByAlertId
    aggregationResult: {[ruleKey in K]: Aggregated}

    constructor(ruleByAlertId: { [k in K]: Rule<T> }) {
        // @ts-ignore Somehow infinite
        this.ruleByAlertId = ruleByAlertId satisfies {[k in K]: RuleSchema};
        // TODO Consider Map
        this.aggregationResult = forIn(ruleByAlertId, () => ({}));
    }

    push(element: T) {
        const {
            ruleByAlertId,
            aggregationResult
        } = this

        for (const alertId in ruleByAlertId) {
            const {
                triggers,
                groupBy
            } = ruleByAlertId[alertId]
            , aggregated = aggregationResult[alertId]
            , key = groupKey(
                //@ts-expect-error
                groupBy,
                element
            )
            .join(GROUP_DELIMITER) as GroupKey

            for (let triggerIndex = 0; triggerIndex < triggers.length; triggerIndex++) {
                let grouped = aggregated[key]

                const aggregation = grouped?.[triggerIndex]
                , result = updateAggregationResult(
                    aggregation,
                    element,
                    triggers[triggerIndex]
                );

                if (!result)
                    continue

                if (!grouped)
                    //@ts-expect-error wtf
                    aggregated[key] = grouped = []

                grouped[triggerIndex] = result
            }
        }
    }

    //@ts-expect-error
    validateRules() {
        const {
            ruleByAlertId,
            aggregationResult
        } = this

        const result = {} as { [k in K]: ReturnType<typeof validateAggregationResult>} satisfies {[k in K]: RuleResultSchema};

        for (const alertId in ruleByAlertId)
            result[alertId] = validateAggregationResult(
                aggregationResult[alertId],
                ruleByAlertId[alertId]
            );

        return result;
    }
}

function createRuleValidator<T, K extends string = string>(
    ruleByAlertId: falsy|{[k in K]: Rule<T>}
) {
    return !ruleByAlertId || isEmptyObject(ruleByAlertId)
    ? blankValidator as RuleValidatorInterface<T, K>
    : new RuleValidator<T, K>(ruleByAlertId);
}

async function validateRules<T, K extends string = string>(iterator: Iterable<T> | AsyncIterable<T>, rules: { [k in K]: Rule<T> }) {
    //@ts-ignore Weird infinite 
    const ruleValidator = createRuleValidator(rules);
    for await (const element of iterator)
        ruleValidator.push(element);
    
    return ruleValidator.validateRules();
}

/** @deprecated */
function validateTrigger<T>(
    grouped: {[key in GroupKey]: Dict},
    aggregations: Trigger<T>["aggregate"],
) {
    const resultOk = {} as ValidationResult
    , resultAll = {} as ValidationResult
    , results = [resultOk, resultAll]
    , {length} = aggregations
    
    // TODO undefined
    let is = false

    for (const k in grouped) {
        const obj = grouped[k as GroupKey]

        // TODO true
        let isValid = true

        for (let a = 0; a < length; a++) {
            const {
                conditions,
                prop,
                expr,
                as = prop,
                agg
            } = aggregations[a]

            if (expr) {
                const {op, args} = expr
                , vals = tryValues(obj, args)
    
                obj[as] = valueOperate(op, vals)        
            }
            
            if (isValid !== false && typeof conditions === "object" && conditions.length) {
                const aggregatedValue = obj[as]
                , is = condEntry(aggregatedValue, conditions)

                if (!is)
                    isValid = false
            }

            // TODO agg vs expr
            // TODO Check override on first agg
            if (!expr) {
                resultAll[as] = valueAggregate(
                    agg,
                    resultAll[as],
                    obj[as]
                )

                if (isValid)
                    resultOk[as] = valueAggregate(
                        agg,
                        resultOk[as],
                        obj[as]
                    )

            }
        }

        if (isValid)
            is = true
    }

    for (let a = 0; a < length; a++) {
        const {
            prop,
            expr,
            as = prop,
        } = aggregations[a]


        if (expr) {
            for (let i = 2; i-->0;) {
                const result = results[i]
                , {op, args} = expr
                , vals = tryValues(result, args)

                result[as] = valueOperate(op, vals)        
            }
        }
    }

    const result = is ? resultOk : resultAll

    result.is = is

    return result
}


function validateFilter<T>(
    element: T,
    logicalOperator: LogicalOperator,
    filter: Trigger<T>["filter"]
) {
    const {length} = filter
    , logical = logicalOperate(logicalOperator)

    let is: Arg0<typeof logical>

    for (let f = 0; f < length; f++) {
        const {
            prop,
            conditions
        } = filter[f]
        , value = getDeep(element, prop)
        , valueIs = condEntry(value, conditions)

        is = logical(is, valueIs)

        if (is === false)
            return is
    }
    
    return logical(is)
}

function validateAggregationResult<T>(
    aggregationResult: Aggregated,
    // logicalOperator: LogicalOperator,
    // triggers: readonly Trigger<T>[],
    {
        "logical": logicalOperator,
        triggers,
        aggregate
    }: Rule<T>
) {
    const {length} = triggers
    // , result = []
    , results: {
        all?: Dict,
        is?: Dict,
    }[] = []
    , agged: Dict = {}
    , logical = logicalOperate(logicalOperator)
    
    for (const k in aggregationResult) {
        // let groupIs: Arg0<typeof logical> = undefined

        const key = k as GroupKey
        , aggregation = aggregationResult[key]
        
        let groupIs = undefined

        for (let t = 0; t < length; t++) {
            const aggregated = aggregation[t]

            if (!aggregated)
                continue

            const {aggregate} = triggers[t]
            , {length} = aggregate
            , resultTrigger = results[t] ??= {}

            // Consider undefined
            let triggerIs = undefined

            for (let a = 0; a < length; a++) {
                const {
                    conditions,
                    prop,
                    expr,
                    as = prop,
                    agg
                } = aggregate[a]

                if (expr) {
                    const {op, args} = expr
                    , vals = tryValues(aggregated, args)
        
                    aggregated[as] = valueOperate(op, vals)        
                }

                if (triggerIs !== false && typeof conditions === "object" && conditions.length) {
                    const aggregatedValue = aggregated[as]
    
                    if (conditions?.length) {
                        const is = condEntry(aggregatedValue, conditions)
        
                        if (!is)
                            triggerIs = false
                        else if (triggerIs === undefined)
                            triggerIs = true
                    }   
                }

                const result = resultTrigger.all ??= {}

                result[as] = valueAggregate(
                    agg,
                    result[as],
                    aggregated[as]
                )
            }

            if (triggerIs) {
                const result = resultTrigger.is ??= {}

                for (let a = 0; a < length; a++) {
                    const {
                        prop,
                        as = prop,
                        agg
                    } = aggregate[a]                
                    result[as] = valueAggregate(
                        agg,
                        result[as],
                        aggregated[as]
                    )
                }
            }

            // , validationResult = validateTrigger(aggregated, aggregate)
            // result[t] = validationResult
                
            groupIs = logical(groupIs, triggerIs)
        }

        if (groupIs && aggregate) {
            const trigged = Object.assign({}, ...aggregation)
            , {length} = aggregate

            for (let a = 0; a < length; a++) {
                const {
                    agg,
                    prop,
                    as = prop
                } = aggregate[a]

                agged[as] = valueAggregate(
                    agg,
                    agged[as],
                    trigged[as]
                )                
            }
        }
    }

    const trigResults = results as unknown[] as (
        NonNullable<typeof results[number]["all"]> & {
            "is"?: boolean
        }
    )[]

    let is: Arg0<typeof logical> = undefined

    for (let t = triggers.length; t-->0;) {
        const result = results[t]
        , resultIs = result?.is
        , triggerIs = !!resultIs

        trigResults[t] = !result ? {} : result.is || result.all!

        trigResults[t].is = triggerIs
        is = logical(is, triggerIs)
    }

    return {
        is,
        "triggers": trigResults,
        ...agged
    };
}

function updateAggregationResult<T>(
    grouped: undefined|Dict,
    element: T,
    {
        "aggregate": aggregates,
        filter,
        logical
    }: Trigger<T>,
) {
    const is = validateFilter(element, logical, filter)
    , {length} = aggregates

    for (let a = 0; a < length; a++) {
        const aggregation = aggregates[a]
        
        if (aggregation.filter !== false && !is)
            continue

        const {
            prop,
            agg,
            as = prop,
        } = aggregation
        , value = getDeep(element, prop)

        grouped ??={}

        grouped[as] = valueAggregate(
            agg,
            grouped[as],
            value,
        );
    }

    return grouped
}

type ValidationResult = Dict & {
    "is": undefined|boolean
    "result": ({
        "is": undefined|boolean
    } & Dict)[]
}


type Trigger<T> = {
    "logical": LogicalOperator;
    "filter": {
        "prop": Leaves<T>
        "conditions": ConditionEntry[]
    }[];
    "aggregate": Aggregation<T>[]
}

type Aggregation<T> = {
    "prop": Leaves<T>
    "agg": AggregationOperator
    "conditions"?: ConditionEntry[]
    "as"?: string
    "filter"?: boolean
    "expr"?: {
        "op": ValueOperator
        "args": (string|number)[]
    }
}

type Rule<T> = {
    "groupBy": Leaves<T>[];
    "logical": LogicalOperator;
    /** triggers in group are validated with AND operator: trigger1 && ... && triggerN */
    "triggers": Trigger<T>[];
    "aggregate"?: Aggregation<T>[]
}
