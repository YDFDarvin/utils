import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dump, load } from "js-yaml"
import { dirname, resolve } from "path"
import { isDeepStrictEqual } from "util"
import { invoke } from "./fn"
import { jsonStringify, reparse } from "./json"
import "./map-json"
import { lens } from "./object"
import type { Arg1, Arg2 } from "./ts-utils.types"

export type {
  StringifyOpts
}
export {
  makeFixturing,
  getFixture,
  takeFixture,
  fileResolve
}

type StringifyOpts = Arg1<typeof dump> & Arg2<typeof reparse> & {
  "cwd"?: string
}

// TODO Consider
// const pathProp = "__path__" as const

function makeFixturing<Desc = any, Fixture = any>(
  update: boolean,
  pathing: (id: Desc) => string,
  rootOpts?: StringifyOpts
) {
  const cwd = rootOpts?.cwd || process.cwd()

  function take<T = Fixture>(id: Desc, data?: T, opts = rootOpts) {
    const path = pathing(id)

    try {
      return takeFixture<T>(path, cwd, update ? data : undefined, opts)
    } catch (e) {
      console.warn(e)
      return undefined      
    }
  }

  return {
    take
  }
}

function takeFixture<T>(relativePath: string, _dir: string, data?: T, opts?: StringifyOpts) {
  if (!data)
    return getFixture<T>(relativePath, _dir, opts)

  const path = fileResolve(_dir, relativePath)
  , extension = path.match(/\.([^\.]+)$/)![1]
  , previous = getFixture(relativePath, _dir, opts)

  if (!isDeepStrictEqual(previous, data)) {
    const content = invoke(() => {
      switch (extension) {
        case "json":
          return jsonStringify(data, opts?.indent, opts?.replacer)
        case "yaml":
        case "yml": 
          return dump(reparse(data, undefined, opts), {
            // "replacer": defaultReviver,
            ...opts,
          })
        default:
          return `${data}`
      }  
    })

    const dir = dirname(path)
    existsSync(dir) || mkdirSync(dir, {"recursive": true})

    const trajectory = getTrajectory(relativePath)    

    if (trajectory === null)
      writeFileSync(path, content)
    else
      // lensWrite(getFixture(path))
      debugger
  }

  return previous as T
}

function getFixture<T>(relativePath: string, _dir: string, opts?: StringifyOpts) {
  const path = fileResolve(_dir, relativePath)
  , extension = path.match(/\.([^\.]+)$/)![1]
  , data = readFileSync(path).toString()
  , $return = invoke(() => {
    switch (extension) {
      case "json":
        return reparse(JSON.parse(data), undefined, opts)
      case "yaml":
      case "yml": 
        return reparse(load(data), undefined, opts)
  
      default:
        return data
    }  
  }) as T

  if (!$return || typeof $return !== "object")
    return $return

  const trajectory = getTrajectory(relativePath)

  // TODO Consider
  // Object.defineProperty($return, pathProp, {
  //   "value": path
  // })

  if (trajectory === null)
    return $return

  const anchored = lens(
    $return,
    //@ts-expect-error
    trajectory,
    undefined
  )

  return anchored
}

const anchorRegex = /#(.*)/
function fileResolve(dir: string, relativePath: string) {
  return resolve(dir,
    relativePath
    .replace("file://", "")
    .replace(anchorRegex, "")
  )
}

function getTrajectory(relativePath: string) {
  const internalPath = relativePath.match(anchorRegex)?.[1]

  if (!internalPath)
    return null

  const trajectory = internalPath.split("/")
  
  if (trajectory[0] === "")
    trajectory.shift()

  if (trajectory[trajectory.length - 1] === "")
    trajectory.pop()

  if (!trajectory || trajectory.length <= 1 && !trajectory[0] )
    return null

  return trajectory
}

