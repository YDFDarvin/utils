export = data
declare const data: {
  "type": "object",
  "properties": {
    "ENCRYPT_KEY": {
      "type": "string",
      "examples": ["bf3c199c2470cb477d907b1e0917c17b"]
    },
    "ENCRYPT_IV": {
      "type": "string",
      "examples": ["5183666c72eec9e4"]
    },
    "ENCRYPT_ALGO": {
      "type": "string",
      "examples": ["aes-256-cbc"]
    },
    "ENCRYPT_PATTERN": {
      "type": "string",
      "examples": ["(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})"]
    }
  }
}