export = data
const data: {
  "type": "object",
  "additionalProperties": false,
  "required": ["groupBy", "triggers", "logical"],
  "properties": {
    "groupBy": {"type": "array", "items": {"type": "string"}},
    "logical": {"enum": ["$allOf", "$anyOf", "$oneOf"]},
    "triggers": {"type": "array", "items": {
      "type": "object",
      "required": ["logical", "filter", "aggregate"],
      "properties": {
        "logical": {"enum": ["$allOf", "$anyOf", "$oneOf"]},
        "filter": {"type": "array", "items": {
          "type": "object",
          "required": [
            "prop",
            "conditions"
          ],
          "properties": {
            "prop": {"type": "string"},
            "conditions": {"type": "array", "items": {
              "type": "object",
              "required": ["op", "value"],
              "properties": {
                "op": {"enum": [
                  "$eq",
                  "$gt",
                  "$gte",
                  "$in",
                  "$lt",
                  "$lte",
                  "$ne",
                  "$nin"
                ]},
                "value": {}
              }
            }}
          }
        }},
        "aggregate": {"type": "array", "items": {
          "type": "object",
          "required": ["prop", "agg"],
          "properties": {
            "prop": {"type": "string"},
            "agg": {"enum": [
              "$addToSetLean",
              "$count",
              "$first",
              "$last",
              "$max",
              "$min",
              "$nin",
              "$oneOrNull",
              "$range",
              "$sum",
              "$avg"
            ]},
            "as": {"type": "string"},
            "filter": {"type": "boolean"},
            "conditions": {"type": "array", "items": {
              "type": "object",
              "required": ["op", "value"],
              "properties": {
                "op": {"enum": [
                  "$eq",
                  "$gt",
                  "$gte",
                  "$in",
                  "$lt",
                  "$lte",
                  "$ne",
                  "$nin"
                ]},
                "value": {}
              }
            }},
            "expr": {
              "type": "object",
              "properties": {
                "op": {"enum": [
                  "$sum",
                  "$divide",
                  "$multiply",
                  "$add"                  
                ]},
                "args": {"type": "array", "items": {
                  "type": ["string", "number"]
                }}
              }
            }
          }
        }}
      }
    }},
    "aggregate": {"type": "array", "items": {
      "type": "object",
      "required": ["prop", "agg"],
      "properties": {
        "prop": {"type": "string"},
        "agg": {"enum": [
          "$addToSetLean",
          "$count",
          "$first",
          "$last",
          "$max",
          "$min",
          "$nin",
          "$oneOrNull",
          "$range",
          "$sum",
          "$avg"
        ]},
        "as": {"type": "string"},
        "filter": {"type": "boolean"},
        "conditions": {"type": "array", "items": {
          "type": "object",
          "required": ["op", "value"],
          "properties": {
            "op": {"enum": [
              "$eq",
              "$gt",
              "$gte",
              "$in",
              "$lt",
              "$lte",
              "$ne",
              "$nin"
            ]},
            "value": {}
          }
        }},
        "expr": {
          "type": "object",
          "properties": {
            "op": {"enum": [
              "$sum",
              "$divide",
              "$multiply",
              "$add"                  
            ]},
            "args": {"type": "array", "items": {
              "type": ["string", "number"]
            }}
          }
        }
      }
    }}
  }
}