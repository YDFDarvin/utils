export = data
declare const data: {
  "type": "object",
  "required": [
    "RMQ_URL",
    "LOG_LEVEL",
    "LOG_TRACE_CHARS",
    "TEST_PORT",
    "TEST_DB",
    "ARANGO_TEST_DB",
    "METRICS_PREFIX"
  ],
  "properties": {
    "RMQ_URL": {
      "type": "string",
      "format": "uri",
      "default": "amqp://glBtc:gl21436587@localhost:5672/btc"
    },
    "METRICS_PREFIX": {
      "type": "string",
      "default": ""
    },
    "TEST_PORT": {
      "type": "number",
      "minimum": 1,
      "default": 3001
    },
    "TEST_DB": {
      "type": "string",
      "format": "uri",
      "default": "mongodb://localhost:27017/test",
      "examples": [
        "Weird issue with mongodb://localhost:27017/test?authSource=admin"
      ]
    },
    "ARANGO_TEST_DB": {
      "type": "string",
      "format": "uri",
      "default": "http://localhost:27017/test",
      "examples": [
        "Weird issue with http://localhost:27017/test"
      ]
    },
    "ADDRESS_PATTERN": {
      "type": "string",
      "default": "^(?:(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})|0:[0-9a-fA-F]{64})$",
      "examples": [
        "^(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})$",
        "^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$",
        "^0:[0-9a-fA-F]{64})$"
      ]
    },
    "LOG_LEVEL": {
      "type": "string",
      "enum": ["debug", "info", "log", "warn", "error", "off"],
      "default": "warn"
    },
    "LOG_TRACE_CHARS": {
      "type": "string",
      "default": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+*<>=_~@#%:^$"
    },
    "LOG_DEPTH": {
      "type": "integer",
      "default": 1
    }
  }
}
