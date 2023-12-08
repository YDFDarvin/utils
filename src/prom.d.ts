import * as p from "prom-client";

declare module "prom-client" {
  type MeteredValue<L extends string> = {
    labels: LabelValues<L>
    value: number
    metricName: string
  }

  type WithHashMap<L extends string> = {
    hashMap: Record<string, MeteredValue<L>>
  }

  interface metric extends WithHashMap<string> {
    //@ts-expect-error
    collect?: p.metric["collect"]
  }

  type R<L extends string, B extends {collect?: any}> = Required<Omit<B, "collect">> & Pick<B, "collect"> & WithHashMap<L>

  export type MetricJson<L extends string>
  = Pick<metric, "name"|"type"|"help"|"aggregator">
  & {
    values: MeteredValue<L>[]
  }

  interface Counter<T extends string> extends R<T, CounterConfiguration<T>> {
    get(): Promise<MetricJson<T>>
  }

  interface Gauge<T extends string> extends R<T, GaugeConfiguration<T>> {
    get(): Promise<MetricJson<T>>
  }

  interface Histogram<T extends string> extends R<T, HistogramConfiguration<T>> {
    get(): Promise<MetricJson<T>>
  }

  interface Summary<T extends string> extends R<T, SummaryConfiguration<T>> {
    get(): Promise<MetricJson<T>>
  }
}