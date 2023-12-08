import Ajv from "ajv";
import { fullFormats } from "ajv-formats/dist/formats";
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  metric,
  register as globalRegister,
  Registry,
  Summary
} from "prom-client";
import { sleep } from './async';
import {
  promOpts
} from "./config";

export type Metric = metric & {
  "values": Array<{
    "value": number,
    "labels": Partial<{
      "space": string
      "le": number
      "kind": string
      "type": string
    }>
    "metricName"?: string
  }>
}

const ajv = new Ajv({
  "verbose": true,
  "allErrors": true,
  "strict": true,
  "strictRequired": false,
  "allowUnionTypes": true,
  "formats": {
    ...fullFormats
  }
})

describe("default", () => {
  let register: Registry

  beforeAll(() => {
    register = new Registry()

    collectDefaultMetrics({
      ...promOpts,
      register,
    })
  })
  afterAll(() => register.clear())

  describe(collectDefaultMetrics.name, () => {
    it("keys", () => expect(Object.keys(collectDefaultMetrics)).toStrictEqual(["metricsList"]))

    //@ts-expect-error
    it("metricsList", () => expect(collectDefaultMetrics.metricsList).toStrictEqual([
      "processCpuTotal",
      "processStartTime",
      "osMemoryHeap",
      "processOpenFileDescriptors",
      "processMaxFileDescriptors",
      "eventLoopLag",
      "processHandles",
      "processRequests",
      "heapSizeAndUsed",
      "heapSpacesSizeAndUsed",
      "version",
      "gc",
    ]))
  })

  describe(Registry.name, () => {
    it("keys", () => expect(Object.keys(register)).toStrictEqual([
      "_metrics",
      "_collectors",
      "_defaultLabels",
    ]))

    describe(Registry.prototype.getMetricsAsJSON.name, () => {
      const metrics: Metric[] = []
      
      beforeAll(async () => metrics.push(
        //@ts-ignore
        ...await register.getMetricsAsJSON() as Metric[])
      )

      // `NaN` appears somewhere
      beforeAll(() => ajv.opts.strictNumbers = false)
      afterAll(() => ajv.opts.strictNumbers = true)

      it("names", () => expect([...metrics.reduce((acc, m) => acc.add(
        //@ts-ignore
        m.name
      ), new Set<string>())].sort()).toStrictEqual([
        "nodejs_active_handles",
        "nodejs_active_handles_total",
        "nodejs_active_requests",
        "nodejs_active_requests_total",
        "nodejs_eventloop_lag_max_seconds",
        "nodejs_eventloop_lag_mean_seconds",
        "nodejs_eventloop_lag_min_seconds",
        "nodejs_eventloop_lag_p50_seconds",
        "nodejs_eventloop_lag_p90_seconds",
        "nodejs_eventloop_lag_p99_seconds",
        "nodejs_eventloop_lag_seconds",
        "nodejs_eventloop_lag_stddev_seconds",
        "nodejs_external_memory_bytes",
        "nodejs_gc_duration_seconds",
        "nodejs_heap_size_total_bytes",
        "nodejs_heap_size_used_bytes",
        "nodejs_heap_space_size_available_bytes",
        "nodejs_heap_space_size_total_bytes",
        "nodejs_heap_space_size_used_bytes",
        "nodejs_version_info",
        "process_cpu_seconds_total",
        "process_cpu_system_seconds_total",
        "process_cpu_user_seconds_total",
        "process_heap_bytes",
        "process_max_fds",
        "process_open_fds",
        "process_resident_memory_bytes",
        "process_start_time_seconds",
        "process_virtual_memory_bytes",
      ].sort()))

      it.skip("schema", () => expect(metrics).toMatchSchema({
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "help",
            "type",
            "aggregator",
            "values"
          ],
          "properties": {
            "name": {"type": "string"},
            "help": {"type": "string"},
            "type": {"enum": [
              "histogram",
              "gauge",
              "counter"
            ]},
            "aggregator": {"enum": [
              "sum",
              "average",
              "first",
              "omit",
              "min",
              "max"
            ]},
            "values": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "value",
                  "labels"
                ],
                "properties": {
                  "value": {
                    "oneOf": [
                      {"type": "number"},
                      {"const": NaN}
                    ]
                  },
                  "labels": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "type": {"enum": [
                        "ReadStream",
                        "WriteStream",
                        "FSWatcher",
                        "FSReqCallback",
                        "Socket",
                        "ChildProcess"
                      ]},
                      "space": {"enum": [
                        "read_only",
                        "old",
                        "code",
                        "map",
                        "new",
                        "large_object",
                        "new_large_object",
                        "code_large_object"
                      ]},
                      "version": {},
                      "major": {},
                      "minor": {},
                      "patch": {}
                    }
                  }
                }
              }
            }
          }
        }
      }))
    })
  })
})

describe("custom", () => {
  const commonMethods = [
    "constructor",
    "get",
    "remove",
    "labels",
    "reset",
  ]

  describe(Counter.name, () => {
    it("methods", () => expect(Object.getOwnPropertyNames(Counter.prototype).sort()).toStrictEqual([
      ...commonMethods,
      "inc",
    ].sort()))

    describe("Without labels", () => {
      const opts = {
        "name": "cnt",
        "help": "Cnt",
      } as const
      , counter = new Counter(opts)

      it("New blank", () => expect({...counter}).toStrictEqual({
        ...opts,
        "aggregator": "sum",
        "hashMap": {
          "": {
            "labels": {},
            "value": 0
          },
        },
        "labelNames": [],
        "registers": [globalRegister]
      }))

      describe(counter.inc.name, () => {
        beforeAll(() => counter.inc(10))
        it(".hashMap", () => expect(counter.hashMap).toStrictEqual({
          "": {
            "value": 10,
            "labels": {}
          }
        }))

        it(".get()", async () => expect(await counter.get()).toMatchObject({
          "values": [{
            "value": 10,
            "labels": {}
          }]
        }))
      })
    })

    it("With labels", async () => {
      const c = new Counter({
        "name": "count_labeled",
        "help": "Count",
        "labelNames": ["l1", "l2"]
      })

      c.inc({"l1": 1, "l2": 2}, 10)
      c.inc({"l1": 1}, 11)
      c.inc({"l2": 2}, 12)

      expect(c.hashMap).toStrictEqual({
        "l1:1,l2:2": {
          "labels": {
            "l1": 1,
            "l2": 2,
          },
          "value": 10,
        },
        "l1:1": {
          "labels": {"l1": 1,},
          "value": 11,
        },
        "l2:2": {
          "labels": {"l2": 2,},
          "value": 12,
        }
      })
    })
  })

  describe(Gauge.name, () => {
    const gauge = new Gauge({
      "name": "g",
      "help": "g"
    })

    it("methods", () => expect(Object.getOwnPropertyNames(Gauge.prototype).sort()).toStrictEqual([
      ...commonMethods,
      "inc",
      "set",
      "dec",
      "setToCurrentTime",
      "startTimer",
      "_getValue",
    ].sort()))

    it(`1. ${gauge.inc.name}`, () => {
      gauge.inc(2)
      expect(gauge.hashMap).toStrictEqual({
        "": {
          "labels": {},
          "value": 2
        }
      })
    })

    it(`2. ${gauge.dec.name}`, () => {
      gauge.dec(3)
      expect(gauge.hashMap).toStrictEqual({
        "": {
          "labels": {},
          "value": -1
        }
      })
    })

    it(gauge.set.name, () => {
      gauge.set(2)
      expect(gauge.hashMap[""].value).toBe(2)
    })

    it(gauge.setToCurrentTime.name, () => {
      gauge.setToCurrentTime()
      expect(gauge.hashMap[""].value).toBeCloseTo(Date.now() / 1000)
    })

    it(gauge.startTimer.name, async () => {
      const end = gauge.startTimer()
      await sleep(100)
      end()

      expect(gauge.hashMap[""].value).toBeCloseTo(0.1, 1)
      expect(gauge.hashMap).toStrictEqual({
        "": {
          "labels": {},
          "value": expect.any(Number)
        }
      })
    })
  })

  describe(Histogram.name, () => {
    const histogram = new Histogram({
      "name": "hist",
      "help": "hist",
      "buckets": [2, 4],
    })

    it("methods", () => expect(Object.getOwnPropertyNames(Histogram.prototype).sort()).toStrictEqual([
      ...commonMethods,
      "observe",
      "zero",
      "startTimer",
    ].sort()))

    it(histogram.observe.name, async () => {
      histogram.observe(1)
      histogram.observe(2)
      histogram.observe(3)
      histogram.observe(4)
      histogram.observe(5)
      histogram.observe(6)

      expect(await histogram.get()).toStrictEqual({
        "aggregator": "sum",
        "help": "hist",
        "name": "hist",
        "type": "histogram",
        "values": [{
          "labels": {"le": 2},
          "metricName": "hist_bucket",
          "value": 2,
        }, {
          "labels": {"le": 4},
          "metricName": "hist_bucket",
          "value": 4,
        }, {
          "labels": {"le": "+Inf"},
          "metricName": "hist_bucket",
          "value": 6,
        }, {
          "labels": {},
          "metricName": "hist_sum",
          "value": 1 + 2 + 3 + 4 + 5 + 6,
        }, {
          "labels": {},
          "metricName": "hist_count",
          "value": 6,
        }],
      })
    })
  })

  describe(Summary.name, () => {
    it("methods", () => expect(Object.getOwnPropertyNames(Summary.prototype).sort()).toStrictEqual([
      ...commonMethods,
      "observe",
      "startTimer",
    ].sort()))

    describe("simple", () => {
      const summary = new Summary({
        "name": "smr",
        "help": "Smr",
        "percentiles": [0.2, 0.5, 0.8],
      })

      it(summary.observe.name, async () => {
        summary.observe(1)
        summary.observe(2)
        summary.observe(3)

        expect(await summary.get()).toStrictEqual({
          "aggregator": "sum",
          "help": "Smr",
          "name": "smr",
          "type": "summary",
          "values": [{
            "labels": {"quantile": 0.2},
            "value": 1.1,
          }, {
            "labels": {"quantile": 0.5},
            "value": 2,
          }, {
            "labels": {"quantile": 0.8},
            "value": 2.9000000000000004,
          }, {
            "labels": {},
            "metricName": "smr_sum",
            "value": 6,
          }, {
            "labels": {},
            "metricName": "smr_count",
            "value": 3,
          }]
        })
      })
    })
  })
})
