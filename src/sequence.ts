import type { primitive } from "./ts-utils.types"

const {min: $min} = Math

export {
  updateIndex
}

function updateIndex<T extends primitive>(base: T[], patch: T[]) {
  const patchStart = base.lastIndexOf(patch[0])

  if (patchStart === -1)
    throw Error("Unrelated")

  const {"length": patchLength} = patch
  , checkLength = $min(patchLength, base.length - patchStart)

  let p = 0

  for (p; p < checkLength; p++)
    if (base[p + patchStart] !== patch[p])
      throw Error("Conflict")
  
  if (p === patchLength)
    return null

  return p
}