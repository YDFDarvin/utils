import {
  Inject,
  Injectable,
  Module
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  dbUrl,
  rmqUrl
} from "./config";
import {
  NestRmqClient,
  RmqApiModule,
  RmqOpts,
  startRmqService
} from "./nest";
import { mongooseModules } from "./nest-mongo";
import { RmqClient } from "./rmq";
import type {
  Dict,
  Fn
} from "./ts-utils.types";

const rmqParams: RmqOpts = {
  "urls": [rmqUrl],
  "queue": "test-health",
  "queueOptions": {
    "durable": false,
  },
  "persistent": true,
  "socketOptions": {
    "heartbeatIntervalInSeconds": 0,
  }
}
, collectionName = "test-health"

export {
  rmqParams,
  collectionName,
  start
};

@Injectable()
class SomeApi extends RmqClient<Dict<undefined|Fn>> {
  @Inject(rmqParams.queue) client!: NestRmqClient
}
@RmqApiModule(rmqParams, SomeApi)
class SomeExternal {}

@Injectable()
class SomeModel {
  @InjectModel("model") model!: Model<Dict>
}

@Module({
  "imports": [
    ...mongooseModules({
      "my": {
        "url": dbUrl,
        "opts": {},
        "models": {"model": {"collection": collectionName}},
      }
    })
  ],
  "providers": [SomeModel],
  "exports": [SomeModel]
})
class ModelModule {}

@Injectable()
class Service {
  @Inject(SomeApi) client!: SomeApi
  @Inject(SomeModel) model!: SomeModel
}

@Module({
  "imports": [
    SomeExternal,
    ModelModule
  ],
  "providers": [
    Service
  ]
})
class MainModule {}

function start() {
  return startRmqService(MainModule, rmqParams)
}