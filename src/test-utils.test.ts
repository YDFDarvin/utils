import { parseDependencies } from "./test-utils"

describe(parseDependencies.name, () => {
  it("demo", () => expect(parseDependencies({
    "cwd": "./",
    "data": [
      "repo1: path1",
      "# repo2: path2",
      "repo3:path/3",
      "repo4",
      "repo5:",
      "",
    ].join("\n")
  })).toStrictEqual({
    "./repo1": "path1",
    "./repo3": "path/3",
    "./repo4": undefined,
    "./repo5": "",
  }))
})