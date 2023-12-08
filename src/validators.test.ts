import {
  validateAddress
} from "./validators";

describe(validateAddress.name, () => {
  it("Demo", () => expect(validateAddress(
    "bc1pwvua5eg09rle85jz9wsk8q3zhe6wtsyxgws9nrnsgmaarhhl32kq05ksn2"
  )).toBe(true))
})
