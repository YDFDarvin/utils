import {
  decrypt,
  EncOpts,
  encrypt,
  maskPattern
} from "./encryption";

describe(maskPattern.name, () => {
  it("Demo", () => {
    const address = "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"
    , input = JSON.stringify({address})

    expect(
      maskPattern(input)
      .indexOf(address)
    ).toBe(-1)
    expect(JSON.parse(maskPattern(input))).toStrictEqual({
      "address": "gekszwSvPNWHKwFPxBmhGejnD9QvpprkTCEgZzwot606/wrt43F56RgptSIDJbxW"
    })
  });

  it("Something changed", () => {
    const address = "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"

    expect(
      maskPattern(JSON.stringify({address}))
      .indexOf(address)
    ).toBe(-1)
  });

  it("Multiple occurrences", () => {
    const address = "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"
    , enced = "gekszwSvPNWHKwFPxBmhGejnD9QvpprkTCEgZzwot606/wrt43F56RgptSIDJbxW"

    expect(JSON.parse(maskPattern(JSON.stringify({
      address,
      "address2": address,
      "substr": `xxx${address}xxx`
    })))).toStrictEqual({
      "address": enced,
      "address2": enced,
      "substr": `xxx${enced}xxx`
    })
  })

  it("No options", () => {
    const log = JSON.stringify({"address": "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"})

    expect(
      maskPattern(log, {})
    ).toBe(log)
  });
});

describe("enc + dec", () => {
  const opts: EncOpts = {
    "algorithm": "aes-256-cbc",
    "key": "bf3c199c2470cb477d907b1e0917c17b",
    "iv": "5183666c72eec9e4"
  }

  it(encrypt.name, () => expect(encrypt(
    '{"address": "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"}', opts
  )).toBe(
    "zBTZvzRMlWS7EnjnbREmJ0Uu9ac1U3f3Uk3dJolRET6RIdsSjJoj5AJoIOW2jgPuv7/p/mmTJ3qOwOqgWDzKig=="
  ))

  it(decrypt.name, () => expect(decrypt(encrypt(
    '{"address": "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"}', opts
  ), opts)).toBe(
    '{"address": "3HeuEghVDSW5R2r5Qp9Pc5vuWLNjwSFVSP"}'
  ))
})
