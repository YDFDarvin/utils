import { urlBuild } from "./url";

describe(urlBuild.name, () => {
  it("empty", () => expect(urlBuild({})).toBe(""))

  it("demo", () => expect(urlBuild({
    "protocol": "protocol",
    "user": "user",
    "pass": "pass",
    "host": "host",
    "port": "port",
    "path": "dbName",
    "search": {
      "authSource": "admin"
    }
  })).toBe(
    "protocol://user:pass@host:port/dbName?authSource=admin"
  ))

  it("keep protocol", () => expect(urlBuild({
    "protocol": true
  })).toBe("//localhost"))


  it("user without pass", () => expect(urlBuild({
    "user": "user"
  })).toBe(
    "user@localhost"
  ))

  it("search: string", () => expect(urlBuild({
    "search": "abc=def"
  })).toBe("?abc=def"))

  it("path: string", () => expect(urlBuild({
    "path": "dev"
  })).toBe("/dev"))

})