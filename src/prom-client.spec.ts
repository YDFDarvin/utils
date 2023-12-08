import type { Histogram } from "prom-client";
import { sleep } from "./async";
import { promOpts } from "./config";
import {
  counter,
  gauge,
  histogram,
  init,
  measureHistogram,
  metrics,
  registry
} from "./prom-client";

describe("Scenario", () => {
  const name = "measure_histogram_test"

  beforeAll(() => registry.clear())

  it("0. Not inited", async () => {
    expect(
      registry.getSingleMetric(name)
    ).toBeUndefined()

    expect(
      await metrics()
    ).toBe("\n")
  })

  it("1. Init", async () => {
    init(promOpts)

    expect(
      await metrics()
    ).toMatch(/^# HELP /)
  })

  it("2. Measure 1st time", async () => {
    expect(
      await measureHistogram(
        {
          name,
          "help": name
        },
        sleep(100).then(() => 1)
      )
    ).toBe(1)

    expect(await getCount(histogram({
      name,
      "help": name
    }))).toBe(1)
  })

  it("3. Measure 2nd time with error", async () => {
    await expect(
      measureHistogram(
        {
          name,
          "help": name
        },
        sleep(100).then(() => Promise.reject("2"))
      )
    ).rejects.toBe("2")

    expect(await getCount(histogram({
      name,
      "help": name
    }))).toBe(2)
  })

  it("4. Reinit - metrics are not flushed", async () => {
    init(promOpts)

    expect(await getCount(histogram({
      name,
      "help": name
    }))).toBe(2)
  })

  it("5. After grab metrics still persist", async () => {
    await metrics()

    expect(await getCount(histogram({
      name,
      "help": name
    }))).toBe(2)
  })
})

describe("smoke", () => {
  it(counter.name, async () => {
    const metric = counter({"name": "test_counter", "help": "test_counter"})
    metric.inc()

    expect(
      await metric.get().then(m => m.values)
    ).toStrictEqual([{"labels": {}, "value": 1}])
  })

  it(gauge.name, async () => {
    const metric = gauge({"name": "test_gauge", "help": "test_gauge"})
    metric.set({}, 2)

    expect(
      await metric.get().then(m => m.values)
    ).toStrictEqual([{"labels": {}, "value": 2}])
  })
})

async function getCount(metric: Pick<Histogram<string>, "get">) {
  return (
    await metric.get()
  )
  .values
  .find(m => m.metricName.endsWith("_count"))
  ?.value

}