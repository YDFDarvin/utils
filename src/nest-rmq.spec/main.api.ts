import { Inject, Injectable } from "@nestjs/common";
import { NestRmqClient, RmqApiModule } from "../nest";
import { RmqClient } from "../rmq";
import { rmqMain } from "./config";

export type MainInterface = {
  run(payload: unknown): Promise<true>
}

@Injectable()
export class MainClient extends RmqClient<MainInterface> {
  @Inject(rmqMain.queue) client!: NestRmqClient
}

@RmqApiModule(rmqMain, MainClient)
export class MainApi {}
