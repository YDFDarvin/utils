import fetch from "node-fetch"
import { doEnv } from "./env"

export { wealthCheck }

/* istanbul ignore next: Hard to collect coverage from fork */
if (require.main === module) 
  wealthCheck({"port": doEnv({
    "type": "object",
    "required": ["METRICS_PORT"],
    "properties": {
      "METRICS_PORT": {"type": "integer", "minimum": 1}
    }
  } as const).METRICS_PORT})
  .then(r => {
    if (!r.ok)
      return Promise.reject(r)

    console.log(r.text)

    process.exit(0)
  })
  .catch(e => {
    console.log(e.text ?? e)

    process.exit(1)
  })

async function wealthCheck({port}: {"port": number}) {
  const portNum = +port

  if (Number.isNaN(portNum))
    throw Error(`port is not a number: "${port}"`)

  const r = await fetch(`http://localhost:${port}/liveness`)
  , text = await r.text()
  , data = JSON.parse(text)

  return {
    "ok": r.ok && !!data?.ok,
    text
  }
}