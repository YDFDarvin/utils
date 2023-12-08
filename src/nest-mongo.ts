import type { DynamicModule } from "@nestjs/common";
import type {
  ModelDefinition,
  MongooseModuleOptions
} from "@nestjs/mongoose";
import { MongooseModule } from "@nestjs/mongoose";
import type { IndexData } from "./mongo-indexes";
import type { JsonStrictSchema } from "./schema.types";
import type { Dict, Replace } from "./ts-utils.types";

export {
  mongooseModules
};

type CollectionContracts<ModelName extends string, CollectionName extends string> = {
  [name in ModelName]?: Replace<Omit<ModelDefinition, "name">, {
   "schema"?: any
   "collection": CollectionName
  }> & {
    "jsonSchema"?: null|JsonStrictSchema
  }
}

function mongooseModules<ModelName extends string, CollectionName extends string>(map: {
  [connectionName in string]: {
    "url": string
    "opts": Omit<MongooseModuleOptions, "connectionName"|"uri">
    "models": CollectionContracts<ModelName, CollectionName>
    "indexes"?: {[c in CollectionName]?: Dict<IndexData>}
  }
}) {
  const modules: DynamicModule[] = []

  for (const connectionName in map) {
    const {url, opts, models} = map[connectionName]
    , modelDefs: ModelDefinition[] = []

    for (const name in models) {
      modelDefs.push({
        "schema": {},
        ...models[name],
        name,
      })
    }

    modules.push(
      MongooseModule.forRoot(url, {
        ...opts,
        connectionName
      }),
      MongooseModule.forFeature(modelDefs, connectionName)
    )
  }

  return modules
}
