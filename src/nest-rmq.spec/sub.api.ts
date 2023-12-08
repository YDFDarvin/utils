import { Inject, Injectable } from "@nestjs/common"
import { NestRmqClient, RmqApiModule } from "../nest"
import { RmqClient } from "../rmq"
import { rmqSub } from "./config"

export type SubInterface = {
  run<P = unknown>(payload: Partial<{
    "echo": P
    // "sign": string
    "delay": number
    "stuck": number
    // "exit": number
    "emit": boolean
    "send": boolean
  }>): Promise<P>
}

// const clients = []
//, channels = []

@Injectable()
export class SubClient extends RmqClient<SubInterface> {
  @Inject(rmqSub.queue) client!: NestRmqClient
}

@RmqApiModule(rmqSub, SubClient)
export class SubApi {}
