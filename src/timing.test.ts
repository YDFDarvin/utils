import { sleep } from "./async";
import { convertHrtime, parseHrtimeToMs, parseHrtimeToSeconds } from "./timing";

const {hrtime} = process 


it(parseHrtimeToSeconds.name, () => {
  const t0 = hrtime()

  expect(parseHrtimeToSeconds(hrtime(t0))).toBe(0)
})

it(parseHrtimeToMs.name, async () => {
  const t0 = hrtime()
  await sleep(100)
  expect(parseHrtimeToMs(hrtime(t0)) / 1000).toBeCloseTo(100, -1)
})

it(convertHrtime.name, () => {
  const stamp = convertHrtime(- hrtime.bigint() + hrtime.bigint())

  expect(stamp.nanoseconds).toBeGreaterThan(950n)

  expect(stamp.milliseconds).toBeGreaterThan(0)
  expect(stamp.milliseconds).toBeLessThan(1)

  expect(stamp.seconds).toBeGreaterThan(0)
})
