export = data
const data: {
  "type": "object",
  "properties": {
      "is": {"type": "boolean"},
      "result": {"type": "array", "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "is": {"type": "boolean"}
        }
    }}
  }
}