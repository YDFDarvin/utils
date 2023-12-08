import {
  Gauge,
  metric,
  Metric
} from "prom-client"
import { sleep } from ".//async"
import { fill } from "./array"
import type {
  Arg0,
  Fn
} from "./ts-utils.types"


describe(timerify.name, () => {
  describe("function", () => {
    const gauge = new Gauge({
      "name": fill.name,
      "help": fill.name,
      "labelNames": ["length"],
    })
    gauge.setToCurrentTime()
  
    const fillTimed = timerify(fill, gauge, length => ({length}))

    it("name", () => expect(fillTimed.name).toStrictEqual(fill.name))

    it("val", async () => {
      expect(fillTimed(1000, 0)).toStrictEqual(fill(1000, 0))
      const stat1 = await gauge.get()
      //@ts-ignore
      expect(fillTimed(1000, i => i)).toStrictEqual(fill(1000, i => i))
      const stat2 = await gauge.get()
      
      expect({
        ...stat1,
        "values": stat1.values.map((o, i) => i === 0 ? o : ({
          ...o,
          "value": undefined
        }))
      }).toStrictEqual({
        ...stat2,
        "values": stat2.values.map((o, i) => i === 0 ? o : ({
          ...o,
          "value": undefined
        }))
      })
    })
  })

  describe("async", () => {
    async function echo<T>(value: T, delay: number) {
      await sleep(delay)

      if (value instanceof Error)
        throw value
      
      return value
    }

    const gauge = new Gauge({
      "name": echo.name,
      "help": echo.name,
      "labelNames": ["length"],
    })
    gauge.setToCurrentTime()
  
    const echoTimed = timerify(echo, gauge, undefined)
    
    for (let i = 0; i < 2; i++)
      it(`#${i}`, async () => {
        expect(await echoTimed(1, 100)).toStrictEqual(1)
        const {values} = await gauge.get()

        expect(values).toStrictEqual([{
          "labels": {},
          "value": expect.any(Number)
        }])
        expect(values[0].value).toBeCloseTo(0.1, 1)
      })

  })
})

function timerify<F extends Fn, M extends Pick<Gauge<string>, "startTimer">>(
  fn: F,
  metric: M,
  labeling: Arg0<M["startTimer"]>|((this: ThisParameterType<F>, ...args: Parameters<F>) => Arg0<M["startTimer"]>)
) {
  let {name} = fn
  , timed = {[name]:
    function(this: ThisParameterType<F>, ...args: Parameters<F>) {
      let labels = typeof labeling === "function" ? labeling?.apply(this, args) : labeling
      // TODO Change to own - it is `.set`, not `.inc`
      , end = metric.startTimer(labels)
      , v = fn.apply(this, args)

      if (!(v instanceof Promise)) {
        end(labels)
        return v  
      }

      return v.finally(() => end(labels)
)
    }
  }[name]

  return timed as F
}

export function getMetered<L extends string>(metric: Metric<L>) {
  const m = metric as unknown as Omit<metric, "collect"> & Partial<metric>


  if (m.collect) {
    const v = m.collect();
    return v
  }

  return {
    //@ts-ignore
    help: m.help,
    //@ts-ignore
    name: m.name,
    type: Object.getPrototypeOf(m).name.toLowerCase(),
    values: Object.values(m.hashMap),
    //@ts-ignore
    aggregator: m.aggregator,
  };
}