import {
  Controller,
  createParamDecorator,
  Inject,
  RequestMapping,
  RequestMethod,
  UseGuards,
  type ExecutionContext
} from "@nestjs/common";
import { PARAMTYPES_METADATA } from "@nestjs/common/constants";
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import {
  json,
  urlencoded
} from 'express';
import helmet from 'helmet';
import type { Server } from 'http';
import { deleteUndefined } from "./assoc";
import { makePayload } from "./http";
import {
  appendWealth,
  closePropagator,
  type NestRmqService
} from './nest';
import {
  makeJsonSchemas,
  makeSwaggers,
  prop2httpMethod,
  prop2httpSubUri,
  restArr,
  type RestAbstract,
  type RestMethod
} from "./rest";
import signals from "./signals.json";
import type {
  Arg0,
  Arg1,
  Arg2, Fn,
  OmitStrict
} from './ts-utils.types';

export {
  createNestHttp,
  HttpController,
  HttpHandler,
  HttpPayload
};

// type RestAbstract = RestInterface<
//   AnyObject,
//   {
//     "id": AnyObject
//     "dto": AnyObject
//   }
// >

async function createNestHttp(
  AppModule: unknown,
  params: {
    "port": number,
    "route"?: string
    "limit"?: string|number
    "timeout"?: number
    "wealth"?: Arg1<typeof appendWealth> 
  }
) {
  const {
    limit,
    timeout
  } = params
  , appRef = closePropagator<NestExpressApplication & NestRmqService>({})
  , appPromise = NestFactory.create(AppModule) as Promise<NestExpressApplication & NestRmqService>
  , health = params.wealth && appendWealth(appPromise, params.wealth)
  , app = appRef.app = await appPromise
  , {
    port,
    route
  } = params

  app.enableShutdownHooks(signals)  

  app.use(json({ limit }));
  app.use(urlencoded({ "extended": true, limit }));

  app.enableCors({
    "origin": true,
    "methods": 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    "credentials": true,
  });
  app.use(helmet());
  
  route && app.setGlobalPrefix(route);
  
  return {
    app,
    health,
    async start() {
      await app.init()

      const server: Server = await app.listen(port);
      server.setTimeout(timeout);    

      return app
    },
    close() {
      return Promise.allSettled([
        app.close(),
        /* istanbul ignore next */
        health?.close()
      ])
    }
  };
}

function HttpController<S extends Function & {"prototype": Partial<RestAbstract>}>(
  Service: S,
  params: OmitStrict<Arg0<typeof HttpHandler>, "schemas"|"swaggers"> & {
    "sign"?: Arg0<typeof makeJsonSchemas>
    "schema": Arg1<typeof makeJsonSchemas>
    "id": Arg2<typeof makeJsonSchemas>
  },
  guards?: Parameters<typeof UseGuards>
) {
  const {
    entity,
    schema,
    id,
    sign
  } = params
  , schemas = makeJsonSchemas(sign, schema, id)
  , swaggers = makeSwaggers(sign, schema, id)
  , methodDecor = HttpHandler({
    ...params,
    schemas,
    swaggers
  })
  , servicePrototype = Service.prototype as S["prototype"]
  
  class RestController implements Pick<typeof servicePrototype, Extract<RestMethod, string>> {
    @Inject(Service) readonly service!: S

    "find"!: typeof servicePrototype["find"]
    "get"!: typeof servicePrototype["get"]
    "create"!: typeof servicePrototype["create"]
    "delete"!: typeof servicePrototype["delete"]
    "replace"!: typeof servicePrototype["replace"]
    "update"!: typeof servicePrototype["update"]
    "rebind"!: typeof servicePrototype["rebind"]
    "add"!: typeof servicePrototype["add"]
    "remove"!: typeof servicePrototype["remove"]
    "clear"!: typeof servicePrototype["clear"]
    "values"!: typeof servicePrototype["values"]
    "retrieve"!: typeof servicePrototype["retrieve"]
    "pick"!: typeof servicePrototype["pick"]
  }

  const controllerPrototype = RestController.prototype as S["prototype"]

  for (let r = restArr.length; r-->0;) {
    const key = restArr[r]

    if (!(key in servicePrototype))
      continue

    const fn = async function(this: RestController, payload: any) {
      //@ts-expect-error
      return await this.service[key](payload)
    }

    Object.defineProperty(fn, "name", {
      "value": key
    })
    
    Object.defineProperty(controllerPrototype, key, {
      "value": fn,
      "enumerable": false,
      "configurable": true,
      "writable": true
    })

    methodDecor(
      controllerPrototype,
      //@ts-expect-error
      key,
      Object.getOwnPropertyDescriptor(controllerPrototype, key)
    )
  }

  // TODO UseGuards.apply
  guards && UseGuards(...guards)(RestController)
  ApiTags(entity)(RestController)
  Controller(entity)(RestController)

  return RestController
}

function HttpHandler({entity, idKey, security, schemas, swaggers, subEntity, subIdKey}: {
  "entity": string
  "idKey": string
  "subEntity"?: string
  "subIdKey"?: string
  "security"?: boolean|unknown
  "schemas"?: ReturnType<typeof makeJsonSchemas>
  "swaggers"?: ReturnType<typeof makeSwaggers>
}) {
  const httpDecor = <T extends Partial<RestAbstract>, K extends Extract<keyof T, keyof RestAbstract>>(
    target: T & {[k in keyof RestAbstract]?: Fn},
    prop: K,
    desc: TypedPropertyDescriptor<T[K] & Fn>
  ) => {
    const method = prop2httpMethod(prop)
    , path = prop2httpSubUri(prop, `:${idKey}`, subEntity, `:${subIdKey}`)
    //@ts-expect-error
    , swagger = swaggers?.[prop]

    //@ts-expect-error
    HttpPayload(schemas?.[prop]?.req)(target, prop, 0)

    Reflect.defineMetadata(PARAMTYPES_METADATA, [undefined], target, prop)

    ApiOperation(deleteUndefined({
      // "summary": "",
      // "description": "",
      "security": !security ? undefined
      : security === true ? [{"bearer": []}]
      : security,
      ...swagger,
      "tags": [entity, prop],
    }))(target, prop, desc)

    RequestMapping({
      "method": RequestMethod[method],
      path
    })(target, prop, desc)
  }

  return httpDecor
}

const HttpPayload = createParamDecorator((schema: any, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  , payload = makePayload(schema, request)

  return payload
});