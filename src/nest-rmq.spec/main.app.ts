import {
  Inject,
  Module
} from "@nestjs/common"
import { RmqController } from "../nest"
import type {
  Arg0,
  Logger
} from "../ts-utils.types"
import type { MainInterface } from "./main.api"
import { proxyNop } from "./proxy-nop"
import { SubApi, SubClient } from "./sub.api"

export const received: unknown[] = []

@RmqController
export class MainController implements MainInterface {
  logger = proxyNop<Logger>()
  
  @Inject(SubClient) sub!: SubClient

  async run(payload: Arg0<MainInterface["run"]>) {
    received.push({
      //@ts-expect-error
      ...payload,
      //@ts-expect-error
      "trace": `${payload.trace}` 
    })
    return true as const
  }
}

@Module({
  "imports": [SubApi],
  "controllers": [MainController]
})
export class MainModule {}


