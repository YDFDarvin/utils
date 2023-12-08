import { arangoUrl } from "./arango-url";

describe(arangoUrl.name, () => {
  it("default", () => expect(arangoUrl(
    //@ts-expect-error
    {}
  )).toBe("http://localhost"))

  // it("default", () => expect(arangoUrl({
  //   "protocol": "protocol",
  //   "user": "user",
  //   "pass": "pass",
  //   "host": "host",
  //   "port": "port",
  // })).toBe("protocol://user:pass@host:port"))
})