import type { Dict } from "./ts-utils.types"

export {
  parseDependencies
}

function parseDependencies({data, cwd}: {
  "data": string
  "cwd": string
}) {
  const dependencies: Dict<string> = {}
  , regex = /^(?<repo>[^\s:]+)( *: *(?<path>[^\s]*))?[\s\n\r]*$/mg

  let groups: undefined | Dict<string> = undefined

  while (groups = regex.exec(data)?.groups)
    dependencies[`${cwd}${groups.repo}`] = groups.path
  
  return dependencies
}