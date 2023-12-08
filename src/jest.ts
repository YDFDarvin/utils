import { beforeAll, expect, it } from "@jest/globals"

export {
  expectInRange,
  beforeProm,
  itC
}

function expectInRange(value: number, {
  minimum,
  maximum
}: {
  "minimum": number
  "maximum": number
}, not?: true) {
  let e = expect(value)

  if (not)
    //@ts-ignore Due to `expect` vs `expect.not`
    e = e.not

  return value < minimum ? e.toBeGreaterThanOrEqual(minimum)
  : value > maximum ? e.toBeLessThanOrEqual(maximum)
  : e.toBe(value)
}

/**
 * Mandatory for `it.concurrent`
 * @see https://github.com/jestjs/jest/issues/4281#issuecomment-324087872
 * ### Usage
 * ```typescript
 * const beforeDone = beforeProm(async preparation)
 * 
 * it.concurrent("one", async () => {
 *   await beforeDone
 *   await stuff1()
 * })
 * 
 * it.concurrent("two", async () => {
 *   await beforeDone
 *   await stuff2()
 * })
 * ```
 * 
 * ### What to replace
 * 
 * ```typescript
 * beforeAll(async preparation)
 * 
 * it("one", async () => {
 *   await stuff1()
 * })
 * 
 * it("two", async () => {
 *   await stuff2()
 * })
 * ```
 */
function beforeProm(...args: Parameters<typeof beforeAll>) {
  const cb = args[0]

  let beforeCb: any
  const beforeDone = new Promise<void>(res => beforeCb = res)

  //@ts-expect-error
  args[0] = async function beforeWrap(this) {
    //@ts-expect-error
    await cb.call(this)
    beforeCb()
  }

  beforeAll(...args)

  return beforeDone
}

const itC: typeof it["concurrent"] = process.env.JEST_NO_CONCURRENT
? it
: it.concurrent
