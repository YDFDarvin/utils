import type { properties } from "../env.schema.json";
import type { Signalize } from "./async";

/** @see @nestjs/microservices/record-builders/rmq.record-builder */
type  RmqRecordOptions  = {
  expiration?: string | number;
  timeout?: number;
  userId?: string;
  CC?: string | string[];
  mandatory?: boolean;
  persistent?: boolean;
  deliveryMode?: boolean | number;
  BCC?: string | string[];
  contentType?: string;
  contentEncoding?: string;
  headers?: Record<string, string>;
  priority?: number;
  messageId?: string;
  timestamp?: number;
  type?: string;
  appId?: string;
}

export type primitive = undefined|null|boolean|number|string
export type falsy = undefined|null|false|0|""|void
export type NonFalsy<T> = Exclude<T, falsy>
export type Id<EntityName extends string, Base = string> = Base & {["__entity_key__"]: EntityName}

export type Replace<Source, Replacement extends {[S in keyof Source]?: unknown}>
= Omit<Source, keyof Replacement> & Replacement
export type ReplaceItems<Source extends any[], Replacement extends {[S in keyof Source[number]]?: unknown}>
= Array<Replace<Source[number], Replacement>>

export type Merge<Source, Mergement extends {[S in keyof Source]?: unknown}>
= Omit<Source, keyof Mergement> & {[k in Extract<keyof Mergement, keyof Source>]?: Source[k] | Mergement[k]}


export type ItemOf<A> = Exclude<A, any[]>
| (Extract<A, any[]> extends Array<infer T> ? T : never)

export type Fn<A extends any[] = any[], R = any> = (...args: A) => R
export type Return<F extends Fn> = Awaited<ReturnType<F>>
export type IfReturn<F> = Ever<Return<Extract<F, Fn>>>

export type Itered<I extends AsyncIterable<any>> = I extends AsyncIterable<infer T> ? T : never

export type Dict<V = unknown, K extends string = string> = {[k in K]: V}
export type ReadonlyDict<V = unknown, K extends string = string> = {readonly [k in K]: V}

export type Arg<N extends number, F extends Fn> = Parameters<F>[N]
export type Arg0<F extends Fn> = Parameters<F>[0]
export type Arg1<F extends Fn> = Parameters<F>[1]
export type Arg2<F extends Fn> = Parameters<F>[2]
export type Arg3<F extends Fn> = Parameters<F>[3]

export type Part<T> = {[K in keyof T]: undefined | T[K]}
export type PartSub<T> = {[K in keyof T]?: T[K]}
export type Partest<T> = {[K in keyof T]?: undefined | null | T[K]}
export type PartBinary<T> = T | {[k in keyof T]?: never}

export type PickOnly<T, K extends keyof T> = Pick<T, K> & {[k in Exclude<keyof T, K>]?: never}
export type OmitStrict<T, K extends keyof T> = Omit<T, K>

export type Mutate<Source, Target> = Target & {
  [k in Exclude<keyof Source, keyof Target>]?: never|Source[k]
}

export type OneOf2<T1, T2> = Exclude<T1, Dict>
| Exclude<T2, Dict>
| Ever<
    Extract<T1, Dict>,
    Ever<
      Extract<T2, Dict>,
      Extract<T1, Dict> & {[k in Exclude<keyof Extract<T2, Dict>, keyof Extract<T1, Dict>>]?: undefined},
      Extract<T1, Dict>
    >
  >
| Ever<
  Extract<T2, Dict>,
  Ever<
    Extract<T1, Dict>,
    Extract<T2, Dict> & {[k in Exclude<keyof Extract<T1, Dict>, keyof Extract<T2, Dict>>]?: undefined},
    Extract<T2, Dict>
  >
>

export type AnyOf2<T1, T2> = (T1 & T2) | OneOf2<T1, T2>

export type AnyOf<Ts extends any[]> = Ts extends [infer T1, infer T2, ...infer Tail]
? AnyOf2<T1, AnyOf<[T2, ...Tail]>>
: Ts[number]

export type OneOf<Ts extends any[]> = Ts extends [infer T1, infer T2, ...infer Tail]
? OneOf2<T1, OneOf<[T2, ...Tail]>>
: Ts[number]

export type Nullable<T> = T | null | undefined

export type Project<Schema> = {[k in "_id"|keyof Schema]?: 0|1}
export type ProjectDeep<Schema> = {[k in keyof Schema]?: 0|1|(
  Schema[k] extends (infer T)[] ? ProjectDeep<T>
  : Schema[k] extends Dict ? ProjectDeep<Schema[k]>
  : never
)}

export type ProjectStrict<Schema> = {[k in keyof Schema]?: 0}|{[k in keyof Schema]?: 1}
export type ProjectWithPropsStrict<Schema> = {[k in keyof Schema]?: 0} | (
  {[k in keyof Schema]?: 1}
  & {[k in string]?: 1 | keyof Schema}
)

export type ProjectionStrict<S, P extends ProjectWithPropsStrict<S>> = 0 extends P[keyof P]
? Omit<S, keyof P>
: Pick<S, Extract<keyof P, keyof S>> & {
  [k in Exclude<keyof P, keyof S>]: P[k] extends keyof S ? S[P[k]] : never
}

/** Opposite to `Readonly<T>` */
export type WriteAble<T> = {-readonly [k in keyof T]: T[k]}
export type Projection<Schema, Project> = WriteAble<Pick<Schema,
  Extract<
    {
      [k in keyof Project]: Project[k] extends 0 ? never : k
    }[keyof Project]
  , keyof Schema
  >
>>

export type Promisable<T> = T | Promise<T>

export type EmptyObject = Record<never, never>
export type AnyObject = Record<string, any>
export type AnyReadonlyObject = {readonly [k: string]: any}

export type Ever<If, Then = If, Else = never> = [If] extends [never] ? Else : Then
export type IfNever<MaybeNever, Else = never> = Ever<MaybeNever, MaybeNever, Else>

export type IfKnown<If, Then = If, Else = never> = [unknown] extends [If] ? Else : Then

export type DeepPartial<T> = T extends AnyObject ? {[K in keyof T]?: DeepPartial<T[K]>} : T

type RequireWeak<T, K extends string> = Omit<T, K> & {[k in Extract<K, keyof T>]-?: Exclude<T[k], undefined>}
export type Require<T, K extends keyof T = keyof T> = Omit<T, K> & {[k in K]-?: Exclude<T[k], undefined>}
export type Partize<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type PartUndef<T> = {[k in keyof T]?: undefined | T[k]}
export type Defined<T> = Exclude<T, undefined>

export type Lens<S, Tr extends Readonly<string[]>> = Tr extends readonly [infer K, ...infer Etc]
? (K extends keyof NonNullable<S>
  ? Lens<NonNullable<S>[K], Extract<Etc, string[]>>
  : never
)
: S

export type RecordND<Keys extends string[], V> = Keys extends readonly [infer K, ...infer Etc]
? {[k in Extract<K, string>]: RecordND<Extract<Etc, string[]>, V>}
: V

export type Methods<T> = Pick<T, {[k in keyof T]: T[k] extends Fn ? k : never}[keyof T]>

export type AndArray<T> = T | T[]

export type OrArray<T> = T
// Weird union resolving
// | (T extends Array<infer Item> ? Item : T[])
| Extract<T, any[]>[number] | Exclude<T, any[]>[]

/** Use `RmqClient` in `.api.` */
export type Service<T> = {[k in keyof T]:
  T[k] extends Fn
  ? T[k] extends (p: infer Payload) => infer R
    ? (p: WithMetrics<WithLogger<Payload>>, opts?: RmqRecordOptions) => R
    : never
  : T[k]
}

/** @deprecated Use `Service` */
export type _ServiceAnyResponse<T> = {[k in keyof T]:
  T[k] extends Fn
  ? T[k] extends (p: infer Payload) => infer R
    ? (p: WithLogger<Payload>, opts?: RmqRecordOptions) => Promise<
      undefined | {"success": boolean, "data": null | unknown[]| (Partial<Awaited<R>> & Dict)}
    >
    : never
  : T[k]
}

export type LogLevel = typeof properties["LOG_LEVEL"]["enum"][number]

export type LoggerMethod = (params: Partial<{
  // "message": string
  "method": string
  "duration": number
  [k: string]: any
}>, ...opts: unknown[]) => void

export type Logger = Record<LogLevel, LoggerMethod>

export type Trace = string & Logger

export type WithLogger<T> = T & {
  "trace"?: undefined|Trace
  "signal"?: Signalize
}

export type WithLoggerStrict<T> = T & {
  "trace": undefined|Trace
  "signal": undefined|Signalize
}

export type SugarQuery<T extends Dict> = {
  // Mongo has no `null` notation
  [K in keyof T]?: /*null |*/ T[K]
  | T[K][]
  // TODO reuse Query
}

export type Metric = {
  "metricName": string
  "startedAt": number
}

export type WithMetrics<T = {}> = T & {
  "__metrics"?: Array<Metric>
}

export type Query<T extends Dict> = {
  [K in keyof T]?: T[K]
  // Mongo has no `null` notation
  // | null
  | (
    PartSub<Record<"$in"|"$nin", T[K][]>>
    & (T[K] extends undefined|number ? PartSub<Record<"$gt"|"$gte"|"$lt"|"$lte", number>> : {})
  )
}

export type JsonSchema = {
  "type"?: string|string[]
}
export type Schema2Ts<S extends JsonSchema, Voc extends Record<string, any> = {}>
= S extends {"$ts": string} ? Voc extends {[v in S["$ts"]]: infer T} ? T : never
: S extends {"$ts": string[]} ? Voc extends {[v in S["$ts"][number]]: infer T} ? T : never
: S extends {"const": any} ? S["const"]
: S extends {"enum": any[]} ? S["enum"][number]
: (
  (
    S extends {"type": Array<infer Type> | infer Type}
    ? | ("string" extends Type ? string : never)
      | ("number" extends Type ? number : never)
      | ("integer" extends Type ? number : never)
      | ("boolean" extends Type ? boolean : never)
      | ("null" extends Type ? null : never)
      | ("object" extends Type
        ? RequireWeak<
          S extends {"properties": infer P}
          ? (
            {
              [k in keyof P]?
              //@ts-ignore :(
              : Schema2Ts<P[k], Voc>
            }
          )
          : S extends {"additionalProperties": infer A}
          //@ts-ignore
          ? {[p in
            S extends {"propertyNames": infer N}
            //@ts-ignore
            ? Extract<Schema2Ts<N, Voc>, string>
            : string
            //@ts-ignore
          ]?: Schema2Ts<A, Voc>}
          : never
        , 
        //@ts-expect-error
          S extends {readonly "required": readonly (infer R)[]}
          ? R
          : never
        > : never
      ) 
      | (
        "array" extends Type
        //@ts-ignore :(
        ? Array<S extends {"items": infer I} ? Schema2Ts<I, Voc>: unknown>
        : never
      )
    : unknown
  )
  & (
    // Actually it is wrong expression
    S extends {"anyOf": readonly unknown[]}
    //@ts-ignore :(
    ? AnyOf<SchemaTuple2TsTuple<S["anyOf"], Voc>>
    : unknown
  )
  & (
    S extends {"oneOf": readonly unknown[]}
    ? //@ts-ignore :(
      OneOf<SchemaTuple2TsTuple<S["oneOf"], Voc>>
      // Schema2Ts<S["oneOf"], Voc>
    : unknown
  )
)

export type SchemaTuple2TsTuple<X extends JsonSchema[], Voc extends Dict> = X extends [infer First, ...infer Tail] 
//@ts-ignore
? [Schema2Ts<First, Voc>, ...SchemaTuple2TsTuple<Tail, Voc>]
: []

export type DeepReadonly<T>
= T extends any[]
? readonly DeepReadonly<T[number]>[]
:  T extends Dict<any>
? {readonly [k in keyof T]: DeepReadonly<T[k]>}
: T

/** @see https://github.com/askirmas/ts-swiss/blob/f57519f09ff29956b9eea28bde98193492d2323c/types/tuple.d.ts#L4 */
export type Tuple<T, Length extends number, Required extends boolean, Acc extends unknown[] = []> = Length extends Acc["length"]
? Acc
: Tuple<T, Length, Required,
  Required extends true
  ? [T, ...Acc]
  : [T?, ...Acc]
>

export type TupleSimple<L extends number, T = any, Buffer extends any[] = []> = number extends L ? never
: Buffer["length"] extends L ? Buffer : TupleSimple<L, T, [...Buffer, T]>

export type Dec<x extends number> = Tuple<never, x, true> extends [unknown, ...infer A] ? A["length"] : never

export type JsonPrimitive = null | boolean | number | string;
export type JsonObject = {[k: string]: JsonPrimitive | JsonObject};
export type Json = JsonPrimitive | JsonPrimitive[] | JsonObject[] | JsonObject
/** @see https://github.com/askirmas/ts-swiss/blob/0288559fd0b56cfc542a36eaaa559e60a2508495/types/object.d.ts#L57 */
export type RequiredKeys<T> = { [K in keyof T]-?:
  ({} extends { [P in K]: T[K] } ? never : K)
}[keyof T]

/** @see https://github.com/askirmas/ts-swiss/blob/0288559fd0b56cfc542a36eaaa559e60a2508495/types/object.d.ts#L61 */
export type OptionalKeys<T> = { [K in keyof T]-?:
  ({} extends { [P in K]: T[K] } ? K : never)
}[keyof T]

/** @see https://github.com/askirmas/ts-swiss/blob/0288559fd0b56cfc542a36eaaa559e60a2508495/types/utils.d.ts#L8C1-L12C9 */
export type UnionToIntersection<Union> = (
  Union extends any ? (argument: Union) => void : never
) extends (argument: infer Intersection) => void
? Intersection
: never;

export type Leaves<T, Delimiter extends string = ".">
= T extends primitive ? never
: T extends any[] ? Leaves<T[number], Delimiter>
: T extends AnyObject ? { [K in keyof T]:
  // Extract<K, string>
  | `${
    Extract<K, string>}${Leaves<T[K]> extends never ? ""
    : T[K] extends string ? ""
    //@ts-ignore
    : `${Delimiter}${Leaves<T[K]>}`
  }`
}[keyof T] : never

export type Paths<T, Delimiter extends string = ".">
= T extends primitive ? never
: T extends any[] ? Paths<T[number], Delimiter>
: T extends AnyObject
? { [K in keyof T]:
    Extract<K, string>
    | `${
      Extract<K, string>}${Paths<T[K]> extends never ? ""
      : T[K] extends string ? ""
      //@ts-ignore
      : `${Delimiter}${Paths<T[K]>}`
    }`
  }[keyof T]
: never

export type Trajectories<T> = ReadonlyArray<keyof T | readonly [keyof T, ...string[]]>
//TODO Works not bad but not good 
// type TrajectoriesDeep<T> = Array<{[k in keyof T]: [k?, ...(T[k] extends Dict ? TrajectoriesDeep<T[k]>[number] : [])]}[keyof T]>

export type Values<T> = Extract<T, AnyObject>[keyof Extract<T, AnyObject>]

export type DeepValues<S, D extends number> = 0 extends D ? S
: 1 extends D ? S[keyof S]
: DeepValues<S[keyof S], Dec<D>>
