import { createHash } from "crypto"

export {
  hashSum
}

function hashSum(json: unknown) {
  return createHash("sha1")
  .update(typeof json === "string" ? json : JSON.stringify(json))
  .digest("hex")
  .toString()
}
