import type { Fn } from "../ts-utils.types"

export {
  proxyNop
}
const nop = () => {}

function proxyNop<T extends Record<string, Fn>>() {
  return new Proxy({} as T, {
    get: () => nop
  })
}
