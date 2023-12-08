import envSchema from "../env.schema.json"
import { doEnv } from "./env"
import type { PromOpts } from "./prom-client"

const {
  "RMQ_URL": rmqUrl,
  METRICS_PREFIX,
  "TEST_PORT": port,
  "TEST_DB": dbUrl,
  "ARANGO_TEST_DB": arangoDbUrl,
  /** @deprecated */
  ADDRESS_PATTERN
} = doEnv(envSchema)

const promOpts: PromOpts = {
  "prefix": METRICS_PREFIX,
  port,
  "gcDurationBuckets": [0.1, 1]
}

/** @deprecated */
const addressPattern = RegExp(ADDRESS_PATTERN!);

export {
  arangoDbUrl,
  rmqUrl,
  promOpts,
  dbUrl,
  port,
  addressPattern
}
