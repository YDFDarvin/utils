import { rmqUrl } from "../config";
import type { RmqOpts } from "../nest";

const rmqSub: RmqOpts = {
  "queue": "nest-test-recovery-serv",
  "urls": [rmqUrl],
  "queueOptions": {
    "durable": true,
    // "messageTtl": 1000
  },
  "noAck": false,
  "persistent": true,
  "prefetchCount": 5,
  "isGlobalPrefetchCount": false,
  "socketOptions": {
    "heartbeatIntervalInSeconds": 10,
    "reconnectTimeInSeconds": 1,
    // "noDelay": false,
    // "timeout": 5000
  },
  "reconnectAttempts": 15
}
, rmqMain: RmqOpts = {
  "queue": "nest-test-recovery-api",
  "urls": [rmqUrl],
  "queueOptions": {
    "durable": true,
    // "messageTtl": 1000
  },
  "noAck": false,
  "persistent": true,
  "prefetchCount": 100,
  "isGlobalPrefetchCount": false,
  "socketOptions": {
    "heartbeatIntervalInSeconds": 10,
    "reconnectTimeInSeconds": 1,
    // "noDelay": false,
    // "timeout": 5000,
  },
  "reconnectAttempts": 20
}

export {
  rmqSub,
  rmqMain
};
