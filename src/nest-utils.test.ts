import { sleep } from "./async";
import { IntervalSequence } from "./nest-utils";

describe(IntervalSequence.name, () => {
  it("sync ok", async () => {
    let i = 0

    const interval = new IntervalSequence(() => i++, 100).start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(2)
  })

  it("sync err", async () => {
    let i = 0

    const interval = new IntervalSequence(() => {
      i++
      throw Error("whatever")
    }, 100).start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(2)
  })


  it("async ok", async () => {
    let i = 0

    const interval = new IntervalSequence(async () => {
      await sleep(50);
      i++
    }, 50).start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(2)
  })

  it("async err", async () => {
    let i = 0

    const interval = new IntervalSequence(async () => {
      await sleep(50);
      i++
      throw Error("whatever")
    }, 50).start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(2)
  })

  it("parallel", async () => {
    let i = 0

    const interval = new IntervalSequence(async () => {
      await sleep(50);
      i++
    }, 50)
    .start()
    .start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(2)
  })

  it("timeout=undefined", async () => {
    let i = 0

    const interval = new IntervalSequence(() => i++,
      //@ts-expect-error
      undefined
    ).start()

    await sleep(250)

    await interval.stop()

    expect(i).toBe(0)
  })
})
