import { deleteUndefined } from "./assoc"
import type {
  AnyObject,
  Dict, EmptyObject, Ever, JsonSchema, SugarQuery,
  WithLogger
} from "./ts-utils.types"

export {
  type RestInterface,
  type RestSubInterface,
  type RestAbstract,
  type RestEntityDesc,
  type RestSubEntityDesc,
  type RestJoinDesc,
  type RestMethod,
  prop2httpMethod,
  prop2httpUri,
  restArr,
  makeJsonSchemas,
  makeSwaggers,
  prop2httpSubUri
}

type RestMethod = keyof (
  RestInterface<any, any, any, any>
  & RestSubInterface<any, any, any, any>
)
type RestAbstract = {[r in RestMethod]: Function}

type RestEntityDesc = {
  "dto": Dict
  "id": Dict
  "readonly"?: Dict
  "writeonly"?: Dict
}
type RestSubEntityDesc = {
  "id"?: Dict
  "dto"?: Dict
  "etc"?: Dict
}
type RestJoinDesc = {
  "as"?: string
  "back"?: string
}

type RestInterface<
  Sign extends Dict,
  Entity extends RestEntityDesc,
  SubEntity extends RestSubEntityDesc = EmptyObject,
  Join extends RestJoinDesc = EmptyObject 
> = {
  /** POST /entity */
  create(payload: WithLogger<Sign &
    Entity["dto"] & Entity["writeonly"]
  >): Promise<
    Entity["id"] & Entity["dto"] & Entity["readonly"] // TODO Consider & Join["as"]
  >

  /** GET /entity? */
  find(payload: WithLogger<Sign &
    SugarQuery<Entity["id"] & Entity["dto"] & Entity["readonly"]>
    // TODO Consider & Join["as"] 
  >): Promise<{
    "count": number
    "items": (Sign & Entity["id"] & Entity["dto"] & Entity["readonly"]
    & Ever<
      Extract<Join["as"], string>,
      {[k in string & Join["as"]]: SubEntity["id"][keyof SubEntity["id"]][]},
      EmptyObject
    >)[]
  }>
  /** GET /entity/:id */
  get(payload: WithLogger<Sign &
    Entity["id"]
  >): Promise<null|(
    Entity["id"] & Entity["dto"] & Entity["readonly"] // TODO Consider & Join["as"]
  )>

  /** PUT /entity/:id */
  replace(payload: WithLogger<Sign &
    Entity["id"] & Entity["dto"] & Entity["writeonly"]
  >): Promise<null|(
    // TODO id for consistency
    Entity["id"] & Entity["dto"] & Entity["readonly"] // TODO Consider & Join["as"]
  )>
  /** PATCH /entity/:id */
  update(payload: WithLogger<Sign &
    Entity["id"] & Entity["dto"] & Entity["writeonly"]
  >): Promise<null|(
    // TODO id for consistency
    Entity["id"] & Entity["dto"] & Entity["readonly"]  // TODO Consider & Join["as"]
  )>

  /** DELETE /entity/:id */
  delete(payload: WithLogger<Sign &
    Entity["id"]
  >): Promise<null|{"deleted": number}>
}

type RestSubInterface<
  Sign extends Dict,
  Entity extends RestEntityDesc,
  SubEntity extends RestSubEntityDesc,
  Join extends RestJoinDesc
> = {
  /** PUT /entity/:id/sub */
  rebind(payload: WithLogger<Sign &
    Entity["id"] & Ever<Extract<Join["as"], string>, {
      [k in string & Join["as"]]: SubEntity["id"][keyof SubEntity["id"]][]
    }, EmptyObject>
  >): Promise<null|{"count": number}> 

  /** PATCH /entity/:id/sub */
  add(payload: WithLogger<Sign &
    Entity["id"] & Ever<Extract<Join["as"], string>, {
      [k in string & Join["as"]]: SubEntity["id"][keyof SubEntity["id"]][]
    }, EmptyObject>
  >): Promise<null|{"added": number}> 

  /** DELETE /entity/:id/sub */
  clear(payload: WithLogger<Sign &
    Entity["id"] & Ever<Extract<Join["as"], string>, {
      [k in string & Join["as"]]?: SubEntity["id"][keyof SubEntity["id"]][]
    }, EmptyObject>
  >): Promise<null|{
    "cleared": number
  }>

  /** GET /entity/:id/sub */
  values(payload: WithLogger<Sign &
    Entity["id"]
  >): Promise<Ever<Extract<Join["as"], string>, {
    [k in string & Join["as"]]: SubEntity["id"][keyof SubEntity["id"]][]
  }, EmptyObject> & {
    "count": number
  }> 

  /** GET /entity/:id/sub/:sid */
  pick(payload: WithLogger<Sign &
    Entity["id"] & SubEntity["id"]
  >): Promise<
    SubEntity["etc"] & SubEntity["dto"] & Partial<Entity["dto"]>
  >

  /** DELETE /entity/:id/sub/:sid */
  remove(payload: WithLogger<Sign &
    Entity["id"] & SubEntity["id"]
  >): Promise<null|{"removed": number}>  

  /** GET /sub/:sid */
  retrieve(payload: WithLogger<Sign &
    SubEntity["id"]
  >): Promise<
    // TODO Consider sid
    SubEntity["etc"] & Ever<Extract<Join["back"], string>, {
      [k in string & Join["back"]]?: (SubEntity["dto"] & Entity["id"])[]
    }, EmptyObject>
  >
}

const restHttpMap = {
  "create": ["POST", ""],
  "find": ["GET", ""],
  "get": ["GET", "{id}"],
  "delete": ["DELETE", "{id}"],
  "replace": ["PUT", "{id}"],
  "update": ["PATCH", "{id}"],
  "rebind": ["PUT", "{id}/{sub}"],
  "add": ["PATCH", "{id}/{sub}"],
  "clear": ["DELETE", "{id}/{sub}"],
  "remove": ["DELETE", "{id}/{sub}/{sid}"],
  /** @todo Consoder name bindings */
  "values": ["GET", "{id}/{sub}"],
  "retrieve": ["GET", "{sub}/{sid}"],
  "pick": ["GET", "{id}/{sub}/{sid}"],
} as const satisfies Record<RestMethod, readonly [
  httpMethod: string,
  path: string
]>
, restArr = Object.keys(restHttpMap) as (keyof typeof restHttpMap)[]
, deleteSchema = {
  "type": "object",
  "required": ["deleted"],
  "properties": {
    "deleted": {"type": "integer"}
  }
}

function makeJsonSchemas<
  Sign extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>},
  Schema extends JsonSchema & {
  "required"?: readonly string[]
  "properties": Dict<JsonSchema & {
    "enum"?: readonly any[]
    "readOnly"?: boolean
    "writeOnly"?: boolean
  }>},
  Id extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>},
  // TODO Sub extends JsonSchema & {
  // "required"?: readonly string[]
  // "properties": Dict<JsonSchema & {
  //   "enum"?: readonly any[]
  //   "readOnly"?: boolean
  //   "writeOnly"?: boolean
  // }>},
  // SubId extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>},
  // Join extends RestJoinDesc
>(
  sign: undefined|Sign,
  schema: Schema,
  id: Id,
  //TODO subSchema?: Sub,
  //TODO subId?: SubId,
  //TODO joinDesc?: Join
) {
  const {
    globalSchema,
    input,
    req,
    output
  } = makeSchemas(sign, schema, id)

  // TODO projection
  return {
    "delete": {"req": globalSchema, "res": deleteSchema},
    "create": {"req": input, "res": output},
    "get": {"req": globalSchema, "res": output},
    "replace": {"req": req, "res": output},
    "update": {"req": {
      ...req,
      "required": globalSchema.required
    }, "res": output},
    "find": {"req": {
      //TODO query
      // TODO pagination
    }, "res": {
      "type": "object",
      "properties": {
        "count": {"type": "integer"},
        "items": output
      }
    }},
  } as const satisfies Partial<{[k in RestMethod]: {
    "req": AnyObject
    "res": AnyObject
  }}>
}

function makeSwaggers<
  Sign extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>},
  Schema extends JsonSchema & {
    "required"?: readonly string[]
    "properties": Dict<JsonSchema & {
      "readOnly"?: boolean
      "writeOnly"?: boolean
    }>},
  Id extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>}
>(
  sign: undefined|Sign,
  schema: Schema,
  id: Id
) {
  const {
    dto,
    output
  } = makeSchemas(sign, schema, id)
  , pathParameters = Object.entries(id.properties).map(([name, schema]) => ({
    name,
    schema,
    "in": "path",
    "required": id.required.includes(name)
  } as const))

  return {
    "find": {
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": {
        "type": "object",
        "properties": {
          "count": {"type": "integer"},
          "items": output
        }
      }}}}}
    },
    "get": {
      "parameters": pathParameters,
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": output}}}}
    },
    "create": {
      "requestBody": {"required": true, "content": {"application/json": {"schema": dto}}},
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": output}}}}
    },
    "delete": {
      "parameters": pathParameters,
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": deleteSchema}}}}
    },
    "replace": {
      "parameters": pathParameters,
      "requestBody": {"required": true, "content": {"application/json": {"schema": dto}}},
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": output}}}}
    },
    "update": {
      "parameters": pathParameters,
      "requestBody": {"required": true, "content": {"application/json": {"schema": deleteUndefined({
        ...dto,
        "required": undefined
      })}}},
      "responses": {"200": {"description": "", "content": {"application/json": {"schema": output}}}}
    },
  } as const satisfies Partial<{[k in RestMethod]: Dict}>
}

function makeSchemas<
  Sign extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>},
  Schema extends JsonSchema & {
    "required"?: readonly string[]
    "properties": Dict<JsonSchema & {
      "readOnly"?: boolean
      "writeOnly"?: boolean
    }>},
  Id extends JsonSchema & {"required": readonly string[], "properties": Dict<JsonSchema>}
>(
  sign: undefined|Sign,
  schema: Schema,
  id: Id
) {
  const {
    properties,
    required,
    ...etc
  } = schema
  // TODO consider id
  , dto = {
    ...etc,
    "properties": {},
  } as Partial<Schema>
  , output = {
    ...etc,
    "properties": {
      // id? sign?
    } as Partial<Schema["properties"]>
  }
  , globalRequired = id.required.concat()

  for (const prop in properties) {
    const propSchema = properties[prop]

    if (!propSchema.writeOnly && !prop.startsWith("_"))
      //@ts-expect-error
      output.properties[prop] = propSchema

    if (!propSchema.readOnly) {
      //@ts-expect-error
      dto.properties[prop] = propSchema

      if (required?.includes(prop)) {
        dto.required ??= [] 
        //@ts-expect-error
        dto.required.push(prop)
      }
    }
  }

  const input = {
    ...etc,
    "required": !dto.required ? [] 
    : dto.required.concat(),
    "properties": {
      ...dto.properties,
      ...id.properties,
    } as Partial<Schema["properties"]>
  }

  if (sign) {
    input.required.push(...sign.required)
    globalRequired!.push(...sign.required)
    Object.assign(input.properties, sign.properties)
  }

  const globalSchema = {
    "type": "object",
    "required": globalRequired,
    "properties": {
      ...id.properties,
      ...sign?.properties
    }
  }
  , req = {
    ...input,
    "required": input.required.concat(id.required),
    "properties": {
      ...input.properties,
      ...id.properties
    }
  }

  return {
    globalSchema,
    dto,
    input,
    req,
    output
  }
}

function prop2httpMethod(prop: RestMethod) {
  return restHttpMap[prop][0]
}

function prop2httpUri<Id, SubId = never>(
  prop: RestMethod,
  entity: string,
  id?: Id,
  subEntity?: string,
  subId?: SubId
) {
  const subpath = prop2httpSubUri(prop, id, subEntity, subId)
  return !subpath ? `/${entity}`
  : `/${entity}/${subpath}`
}

function prop2httpSubUri<Id, SubId = never>(
  prop: RestMethod,
  id?: Id,
  subEntity?: string,
  subId?: SubId
) {
  const subpath = restHttpMap[prop][1]

  if (!subpath)
    return ""

  return !subpath ? ""
  : subpath === "{id}" ? id
  : subpath
  .replace("{id}", `${id}`)
  .replace("{sub}", subEntity!)
  .replace("{sid}", `${subId}`)
}