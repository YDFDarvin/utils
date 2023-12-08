import {
  ceil,
  fixed,
  max,
  min,
  minmax,
  round,
  sum
} from "./math";

describe(round.name, () => {
  it("idfn", () => expect(round(Number.MIN_VALUE, undefined)).toBe(Number.MIN_VALUE))
  
  it("100 = 2 digits after", () => expect(round(0.1111, 100)).toBe(0.11))
})

describe(ceil.name, () => {
  const SCORE_EPSILON = 0.0001;

  it("idfn", () => expect(ceil(50.0001, 0, SCORE_EPSILON)).toBe(50.0001))

  // GLBA-1041
  it("GLBA-1041: SCORE_EPSILON - float case", () =>
    expect(ceil(50.0001, 1, SCORE_EPSILON)).toBe(50)
  )

  it("GLBA-1041: SCORE_EPSILON - integer case", () =>
    expect(ceil(50, 1, SCORE_EPSILON)).toBe(50)
  )
})

describe(minmax.name, () => {
  it("lower", () => expect(minmax(
    1, 2, 4
  )).toBe(
    2
  ))

  it("greater", () => expect(minmax(
    5, 2, 4
  )).toBe(
    4
  ))

  it("in", () => expect(minmax(
    3, 2, 4
  )).toBe(
    3
  ))

  it("miss-use", () => expect(minmax(
    3, 4, 2
  )).toBe(
    4
  ))
})

describe(min.name, () => {
  it("simple demo 1", () => expect(min(
    -1, 0, 1
  )).toBe(-1))

  it("simple demo 2", () => expect(min(
    1, 2, 3
  )).toBe(1))


  it("nothing", () => expect(min(    
  )).toBe(undefined))

  it("only non-number", () => expect(min(
    undefined, null, "0"
  )).toBe(undefined))

  it("only non-number", () => expect(min(
    1, NaN
  )).toBe(1))

  it("mixed", () => expect(min<string|number|null|undefined>(
    1, NaN, null, undefined, "0", "", 0.5
  )).toBe(0.5))
})

describe(max.name, () => {
  it("simple demo 1", () => expect(max(
    -1, 0, 1
  )).toBe(1))

  it("simple demo 2", () => expect(max(
    1, 2, 3
  )).toBe(3))

  it("nothing", () => expect(max(
  )).toBe(undefined))

  it("only non-number", () => expect(max(
    undefined, null, "0"
  )).toBe(undefined))

  
  it("only non-number", () => expect(max(
    1, NaN
  )).toBe(1))

  it("mixed", () => expect(max<string|number|null|undefined>(
    1, NaN, null, undefined, "0", "", 0.5
  )).toBe(1))
})

it(sum.name, () => expect(sum([
  NaN, 1, null, 2
])).toBe(3))

describe(fixed.name, () => {
  it("-0", () => expect(fixed(-0, 5)).toBe(-0))
  it("1", () => expect(fixed(123, 5)).toBe(123))
  it("1.2", () => expect(fixed(123.456, 5)).toBe(123.46))
  it("0.01", () => expect(fixed(0.001234567, 5)).toBe(0.0012345))
  it("100", () => expect(fixed(
    123456789123456789
  , 5)).toBe(
    123450000000000000
  ))
  it("-0.000123456789", () => expect(fixed(
    -0.000123456789, 5
  )).toBe(-0.00012345))
  it("-0.000000123456789", () => expect(fixed(
    -0.000000123456789, 5
  )).toBe(-0.00000012345))
})