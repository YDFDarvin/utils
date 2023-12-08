import { fileResolve, getFixture } from "./fixtures.testing";

describe(fileResolve.name, () => {
  it("ordinary", () => expect(fileResolve(
    "/a/b",
    "c/d"
  )).toBe("/a/b/c/d"))

  it("leading .", () => expect(fileResolve(
    "/a/b",
    "./c/d"
  )).toBe("/a/b/c/d"))

  it("leading ..", () => expect(fileResolve(
    "/a/b",
    "../c/d"
  )).toBe("/a/c/d"))

  it("file leading .", () => expect(fileResolve(
    "/a/b",
    "file://./c/d"
  )).toBe("/a/b/c/d"))

  it("file leading ..", () => expect(fileResolve(
    "/a/b",
    "file://../c/d"
  )).toBe("/a/c/d"))

  it("with internal path", () => expect(fileResolve(
    "/a/b",
    "file://../c/d#/e/f"
  )).toBe("/a/c/d"))
})

describe(getFixture.name, () => {
  it("full file", () => expect(getFixture(
    "file://./fixture.example.yaml", __dirname
  )).toStrictEqual({
    "prop1": {
      "prop2": "value"
    }
  }))

  it("json-pointer @ root file", () => expect(getFixture(
    "file://./fixture.example.yaml#/", __dirname
  )).toStrictEqual({
    "prop1": {
      "prop2": "value"
    }
  }))

  it("json-pointer prop1 @ file", () => expect(getFixture(
    "file://./fixture.example.yaml#/prop1/prop2", __dirname
  )).toBe("value"))

  it("prop1 @ file", () => expect(getFixture(
    "file://./fixture.example.yaml#prop1/prop2", __dirname
  )).toBe("value"))
})