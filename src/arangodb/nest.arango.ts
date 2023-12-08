import type { Database } from 'arangojs';
import type { Config } from 'arangojs/connection';
import { Type, Module } from '@nestjs/common';
import { initArangoDatabase } from './db.arango';
import type { ArangoBaseRepository } from './repository.arango';
import type { Require } from "../ts-utils.types";

export { ArangoApiModule, CollectionName };

function CollectionName(collectionName: string): PropertyDecorator {
  return (target: object, key: string | symbol): void => {
    Reflect.defineProperty(target, key, {
      value: collectionName,
      writable: true,
      enumerable: false,
      configurable: false,
    });
  };
}

function ArangoApiModule(
  arangoParams: Require<Config, 'databaseName' | 'url'>,
  instance: Type<ArangoBaseRepository<any>>,
): ClassDecorator {
  return (target) => {
    Module({
      "providers": [
        {
          "provide": 'db',
          useFactory: async () => await initArangoDatabase(arangoParams),
        },
        {
          "provide": 'collection',
          "useValue": Reflect.get(instance.prototype, 'collection'),
        },
        {
          "provide": instance,
          useFactory: (db: Database, collection: string) => new instance(db, collection),
          "inject": ["db", "collection"],
        },
      ],
      "exports": [instance],
    })(target);
  };
}