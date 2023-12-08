import { afterAll, beforeAll } from "@jest/globals"
import type { ChildProcess } from "child_process"
import { readFileSync } from "fs"
import { resolve } from "path"
import { $all } from "./async"
import { doEnv } from "./env"
import { idfn } from "./fn"
import { forkTs, stopCp } from "./fork"
import { forIn } from "./object"
import { parseDependencies } from "./test-utils"
import type { Dict } from "./ts-utils.types"

export {
  withDependencies
}

/**
 * Usage example:
 * 
 * ```javascript
 * //jest.ci.js
 * const config = {...require("./jest.config.json")}
 * config.setupFilesAfterEnv.push("./libs/utils/src/test-with_dependencies-start.ts")
 * config.globalTeardown = "./libs/utils/src/test-with_dependencies.ts"
 * module.exports = config
 * ```
 */
function withDependencies(env = doEnv(undefined) as Partial<{
  "DEPS_WITH": unknown
  "DEPS_CONFIG": string
  "DEPS_VERBOSE": unknown
  "DEPS_DIR": string
  "METRICS_PORT": string|number
}>) {
  const {
    DEPS_WITH,
    DEPS_CONFIG = "./dependencies.list",
    DEPS_VERBOSE,
    DEPS_DIR = "",
    METRICS_PORT
  } = env

  if (!DEPS_WITH)
    return

  const cps: Dict<ChildProcess> = {}
  , dependencies = parseDependencies({
    "data": readFileSync(DEPS_CONFIG as string).toString(),
    "cwd": DEPS_DIR as string
  })

  beforeAll(() => {
    let inc = 0

    Object.assign(cps, forIn(dependencies, (path, cwd) => forkTs(
      path || require(resolve(cwd, "package.json")).main,
      {
        "silent": !DEPS_VERBOSE,
        cwd,
        "env": {
          ...env as Dict,
          //@ts-ignore
          "METRICS_PORT": METRICS_PORT && (+METRICS_PORT + ++inc)
        }
      })
    ))

    console.log("deps.setup", forIn(cps, cp =>
      /* istanbul ignore next: Impossible  */
      cp.pid || -1
    ))
  })

  afterAll(() =>
    /* istanbul ignore next: Senseless */
    $all(forIn(cps, cp => cp && stopCp(cp)?.then(() => "closed").catch(idfn)))
    .then(t => console.log("deps.teardown", t))
  )

  return cps
}
