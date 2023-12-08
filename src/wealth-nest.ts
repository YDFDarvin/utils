import {
  Controller,
  Get,
  Global,
  Module,
  Res
} from "@nestjs/common";
import type { Response } from "express";
import { metrics } from "./prom-client";

@Controller()
class WealthController {
  @Get('healthcheck')
  healthcheck(@Res() res: Response) {
    return res.writeHead(201).end();
  }

  @Get('readiness')
  readinessCheck() {
    return {
      "status": "ok",
      "info": {},
      "error": {},
      "details": {}
    }
  }

  @Get('metrics')
  metrics() {
    return metrics();
  }
}

@Global()
@Module({
  controllers: [WealthController]
})
class WealthModule {}

export {
  WealthModule
};

