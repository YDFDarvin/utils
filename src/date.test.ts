import { reviveDate } from "./date";

describe(reviveDate.name, () => {
  it("successful", () => {
    const date = new Date()

    date.setMilliseconds(0)

    expect([
      date,
      `${date}`,
      +date
    ].map(reviveDate)).toStrictEqual([
      date,
      date,
      date
    ])
  })

  it("some other", () => expect(reviveDate(
    [1, 2, 3]
  )).toStrictEqual(
    [1, 2, 3]
  ))
})
