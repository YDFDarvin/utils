import {
  makeJsonSchemas,
  makeSwaggers,
  prop2httpMethod,
  prop2httpUri
} from "./rest";

const anyObject = expect.anything()// expect.any(Object)

describe(prop2httpMethod.name, () => {
  it("update", () => expect(prop2httpMethod(
    "update"
  )).toBe("PATCH"))
})

describe(prop2httpUri.name, () => {
  it("create", () => expect(prop2httpUri(
    "create", "entity", "id"
  )).toBe("/entity"))

  it("get", () => expect(prop2httpUri(
    "get", "entity", undefined
  )).toBe("/entity"))
})

describe("JsonSchema", () => {
  const schema = {"type": "object", "required": ["_id", "p1"], "properties": {
    "_id": {"readOnly": true},
    "updatedAt": {"readOnly": true},
    "password": {"writeOnly": true},
    "p1": {}
  }} as const
  , id = {"type": "object", "required": ["id"], "properties": {
    "id": {"type": "integer"}
  }} as const
  , sign = {"type": "object", "required": ["userId"], "properties": {
    "userId": {"type": "string"}
  }} as const

  describe(makeJsonSchemas.name, () => {
    describe("demo", () => {
      const actual = makeJsonSchemas(sign, schema, id)
      , expected = {
        "create": {
          "req": {"type": "object", "required": ["p1", "userId"], "properties": {
            "id": anyObject,
            "userId": anyObject,
            "p1": anyObject,
            "password": anyObject
          }},
          "res": {"type": "object", "properties": {
            "p1": anyObject,
            "updatedAt": anyObject
          }}},
        "find": {
          "req": {},
          "res": anyObject},
        "get": {
          "req": {"type": "object", "required": ["id", "userId"], "properties": {
            "id": anyObject,
            "userId": anyObject
          }},
          "res": {"type": "object", "properties": {
            "p1": anyObject,
            "updatedAt": anyObject
          }}},
        "replace": {
          "req": {"type": "object", "required": ["p1", "userId", "id"], "properties": {
            "id": anyObject,
            "userId": anyObject,
            "p1": anyObject,
            "password": anyObject,
          }},
          "res": {"type": "object", "properties": {
            "p1": anyObject,
            "updatedAt": anyObject
          }}},
        "update": {
          "req": {"type": "object", "required": ["id", "userId"], "properties": {
            "id": anyObject,
            "userId": anyObject,
            "p1": anyObject,
            "password": anyObject
          }},
          "res": {"type": "object", "properties": {
            "p1": anyObject,
            "updatedAt": anyObject
          }}},
        "delete": {
          "req": {"type": "object", "required": ["id", "userId"], "properties": {
            "id": anyObject,
            "userId": anyObject,
          }},
          "res": anyObject}
      }

      for (const prop of new Set(Object.keys({
        ...actual,
        ...expected
      //@ts-expect-error
      }))) it(prop, () => expect(actual[prop]).toEqual(expected[prop]))
    })
  })

  describe(makeSwaggers.name, () => {
    describe("demo", () => {
      const actual = makeSwaggers(sign, schema, id)
      , expected = {
        "find": {
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "count": anyObject,
              "items": anyObject
            }}}}}
          }
        },
        "get": {
          "parameters": [{
            "name": "id",
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "required": true
          }],
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "updatedAt": anyObject,
              "p1": anyObject
            }
          }}}}}
        },
        "create": {
          "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "object",
            "required": ["p1"],
            "properties": {
              "password": anyObject,
              "p1": anyObject
            }
          }}}},
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "updatedAt": anyObject,
              "p1": anyObject
            }
          }}}}}
        },
        "delete": {
          "parameters": [{
            "name": "id",
            "schema": anyObject,
            "in": "path",
            "required": true
          }],
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "required": ["deleted"],
            "properties": {
              "deleted": anyObject
            }
          }}}}}
        },
        "replace": {
          "parameters": [{
            "name": "id",
            "schema": anyObject,
            "in": "path",
            "required": true
          }],
          "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "object",
            "required": ["p1"],
            "properties": {
              "password": anyObject,
              "p1": {}
            }
          }}}},
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "updatedAt": anyObject,
              "p1": {}
            }
          }}}}}
        },
        "update": {
          "parameters": [{
            "name": "id",
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "required": true
          }],
          "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "password": anyObject,
              "p1": anyObject
            }}}}
          },
          "responses": {"200": {"description": "", "content": {"application/json": {"schema": {"type": "object",
            "properties": {
              "updatedAt": anyObject,
              "p1": anyObject
            }
          }}}}}
        }
      }

      for (const prop of new Set(Object.keys({
        ...actual,
        ...expected
      //@ts-expect-error
      }))) it(prop, () => expect(actual[prop]).toEqual(expected[prop]))
    })
  })
})
