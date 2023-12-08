import { collectDefaultMetrics, Counter, DefaultMetricsCollectorConfiguration, Gauge, Histogram, Registry } from 'prom-client';
import { convertHrtime } from './timing';
import type {
  Arg0,
  Promisable,
  Replace,
  Require
} from './ts-utils.types';
import type { WithMetrics } from "./ts-utils.types";

export type PromOpts = {
  "port": number|undefined
} & Require<DefaultMetricsCollectorConfiguration, "prefix">

const {bigint: now} = process.hrtime

let options = undefined as undefined|PromOpts
const registry = new Registry()

export {
  init,
  histogram,
  gauge,
  counter,
  measure,
  measureHistogram,
  metrics,
  observeCrossServiceMetric,
  registry
};

function init(opts: PromOpts) {    
  if (options)
    return
  
  options = opts

  registry.setDefaultLabels({
    "app": opts.prefix
  })

  collectDefaultMetrics({
    "register": registry
  })
}

function histogram(
  params: Replace<ConstructorParameters<typeof Histogram>[0], {
    "name": string,
  }>,
  opts = options
): Histogram<string> {
  const {
    name
  } = params
  , metricsName = `${
    opts!.prefix
  }_${
    name
  }`
  
  let metric = registry.getSingleMetric(metricsName) as Histogram<string>

  if (!metric) {
    metric = new Histogram({
      buckets: [
        0.1, 5, 15, 50, 100, 500, 
        1000, 2000, 4000, 10000, 
        20000, 50000, 100000,
        200000, 500000, 1e6, 1e7,
      ],
      ...params,
      name: metricsName,
      // TODO CONSIDER: registers: [registry]
    });

    registry.registerMetric(metric)
  }

  return metric
}

function gauge(
  params: Replace<ConstructorParameters<typeof Gauge>[0], {
    "name": string,
  }>,
  opts = options
): Gauge<string> {
  const {
    name
  } = params
  , metricsName = `${
    opts!.prefix
  }_${
    name
  }`

  let metric = registry.getSingleMetric(metricsName) as Gauge<string>

  if (!metric) {
    metric = new Gauge({
      ...params,
      "name": metricsName,
      // TODO CONSIDER: registers: [registry]
    })

    registry.registerMetric(metric)
  }

  return metric
}

function counter(
  params: Replace<ConstructorParameters<typeof Counter>[0], {
    "name": string,
  }>,
  opts = options
): Counter<string> {
  const {
    name
  } = params
  , metricsName = `${
    opts!.prefix
  }_${
    name
  }`

  let metric = registry.getSingleMetric(metricsName) as Counter<string>

  if (!metric) {
    metric = new Counter({
      ...params,
      "name": metricsName,
      // TODO CONSIDER: registers: [registry]
    })

    registry.registerMetric(metric)
  }

  return metric
}

async function measure<T>(metric: Histogram<string>, val: Promisable<T>) {
  let result: undefined|T = undefined
  , err: unknown = undefined

  const started = now()

  try {
    result = await val
  } catch (e) {
    err = e
  }
  
  const {"milliseconds": duration} = convertHrtime(now() - started)

  metric.observe(duration)
  
  if (err)
    throw err

  return result!
}

function measureHistogram<T>(opts: Arg0<typeof histogram>, val: Promisable<T>) {
  return measure(histogram(opts), val) 
}

function metrics() {
  return registry.metrics()
}

function observeCrossServiceMetric(
  payload: WithMetrics,
  metricName: string,
  labels: Record<string, string>,
  now: number,
  help?: string,
) {
  const __metric = payload.__metrics?.find(
    (__metric) => metricName === __metric.metricName,
  );

  if (!__metric) {
    return;
  }

  const metric = histogram({
    name: metricName,
    labelNames: Object.keys(labels),
    help: help || '',
  });

  const calculatedTimeMs = (now - __metric.startedAt) / 1000;
  metric.labels(labels).observe(calculatedTimeMs);
}
