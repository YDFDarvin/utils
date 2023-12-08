import type {
  ChildProcess,
  ForkOptions,
  SpawnOptions
} from "child_process";
import {
  fork,
  spawn
} from "child_process";
import signals from "./signals.json";
import type {
  Arg0,
  Replace
} from "./ts-utils.types";

export {
  forkTs,
  spawnTs,
  stopCp
};

/** @deprecated */
/* istanbul ignore next */
function spawnTs(modulePath: Arg0<typeof fork>, opts?: SpawnOptions) {
  return spawn(
    "node",
    [
      "--require=ts-node/register",
      modulePath,
      ...process.execArgv,
    ],
    {
      "detached": true,
      ...opts as unknown as SpawnOptions,
    }
  )
  // .once("error", err => {throw err})
}

function forkTs(modulePath: Arg0<typeof fork>, opts?: Replace<ForkOptions, {
  "env"?: Record<string, undefined|boolean|number|string>
}>) {
  const cp = fork(
    modulePath,
    {
      "silent": true,
      "detached": true,
      ...opts as unknown as ForkOptions,
      "execArgv": [
        "--require=ts-node/register",
        "--inspect",
        ...process.execArgv,
        ...opts?.execArgv ?? []
      ],
    }
  )
  , close = async () => {
    process.removeListener("beforeExit", close)
    signals.forEach(signal => process.removeListener(signal, close))
    cp.removeListener("close", close)
    await stopCp(cp)
  }

  process.once("beforeExit", close)
  signals.forEach(signal => process.once(signal, close))
  cp.once("close", close)

  return cp
}

function stopCp(cp: ChildProcess, signal?: Arg0<ChildProcess["kill"]>) {
  if (cp.killed || typeof cp.exitCode === "number")
    return

  const promise = new Promise<void>(res => {
    cp.once("close", () =>
      res()
    )
  })

  cp.kill(signal)

  return promise
}
