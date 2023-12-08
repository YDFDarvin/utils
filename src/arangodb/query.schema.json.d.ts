export = data
declare const data: {
  "type": "object",
  "properties": {
    "$match": {"type": "object"},
    "$limit": {"type": "number"},
    "$skip": {"type": "number"},
    "$sort": {"type": "string"},
    "$project": {"type": "object"},
    "$filter": {"type": "string"},
    "$unwind": {"type": "string"},
    "$count": {"type": "string"},
    "$lookup": {
      "type": "object",
      "required": ["from", "as", "pipeline"],
      "properties": {
        "from": {"type": "string"},
        "localField": {"type": "string"},
        "foreignField": {"type": "string"},
        "let": {"type": "object"},
        "as": {"type": "string"},
        "pipeline": {
          "type": "array",
          "items": {"type": "object"}
        }
      },
      "additionalProperties": false
    },
    "$groupBy": {"type": "string"},
    "$sample": {
      "type": "object",
      "required": ["size"],
      "properties": {
        "size": {"type": "number"},
        "skip": {"type": "number"},
        "chance": {"type": "number"}
      }
    }
  },
  "additionalProperties": false
}