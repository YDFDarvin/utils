import { expectInRange } from "./jest";

describe(expectInRange.name, () => {
  it("1", () => {
    let err: any = undefined

    try {
      expectInRange(1, {
        "minimum": 2,
        "maximum": 3
      })
    } catch(e) {err = e}

    expect(err).toBeInstanceOf(Error)
  })

  it("2", () => {
    let err: any = undefined

    try {
      expectInRange(1, {
        "minimum": 0,
        "maximum": 2
      }, true)
    } catch(e) {err = e}

    expect(err).toBeInstanceOf(Error)
  })

  it("3", () => {
    let err: any = undefined

    try {
      expectInRange(3, {
        "minimum": 0,
        "maximum": 2
      })
    } catch(e) {err = e}

    expect(err).toBeInstanceOf(Error)
  })
})
