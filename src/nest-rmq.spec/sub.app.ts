import {
  Inject,
  Module,
  OnApplicationShutdown
} from "@nestjs/common"
import { sleep } from "../async"
import {
  RmqController,
  startRmqService
} from "../nest"
import type {
  Arg0,
  Logger
} from "../ts-utils.types"
import { rmqSub } from "./config"
import {
  MainApi,
  MainClient
} from "./main.api"
import { proxyNop } from "./proxy-nop"
import type { SubInterface } from "./sub.api"


export {
  start
}

async function start() {
  return await startRmqService(SubModule, rmqSub, proxyNop<Logger>())
}

@RmqController
class SubController {
  logger = proxyNop<Logger>()

  @Inject(MainClient) api!: MainClient

  async run({
    echo,
    // sign,
    delay,
    stuck,
    // exit,
    emit,
    send
  }: Arg0<SubInterface["run"]>) {
    delay && await sleep(delay)

    if (stuck !== undefined) {
      const start = Date.now()

      while (Date.now() - start < stuck)
        new Array(32 * 1024 * 1024).fill(0)
    }
    
    emit && await this.api.emit.run(echo)
    send && await this.api.send.run(echo)
    
    return echo
  }
}

@Module({
  "imports": [MainApi],
  "controllers": [SubController]
})
class SubModule implements OnApplicationShutdown {
  onApplicationShutdown(_?: string | undefined) {
    console.log("=== GOING DOWN ===")
    // TODO something
  }
}

if (require.main === module)
  start()
