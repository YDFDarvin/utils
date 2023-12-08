import type { Database } from "arangojs";
import type { AqlQuery } from "arangojs/aql";
import type { CollectionMetadata } from "arangojs/collection";
import type { ArrayCursor } from "arangojs/cursor";
import type { PersistentIndex } from "arangojs/indexes";
import { Inject } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common/interfaces/hooks";
import type { Arg0, Arg1, Dict } from "../ts-utils.types";
import type { ArangoBaseDocument } from "./db.types";
import { append } from "../object";
import { PreventInjections } from "./security";
import { serializePipeline } from "./serialization";

const { assign: $assign } = Object
, {random: $random, abs: $abs} = Math

export {
  ArangoBaseRepository,
  count,
  findMany,
  findOne,
  aggregate,
  insertMany,
  removeDocument
}

export type { ISearch }

type ToArray<T> = { "toArray": () => Promise<T[]> };

type ISearch<T> = Partial<{
  "$match": Partial<Record<keyof T, T[keyof T] | T[keyof T][]>>;
  "$limit": number;
  "$skip": number;
  "$sort": string;
  "$project": Partial<Record<string, string|0|1>>;
  "$filter": string;
  /* @experimental */
  "$lookup": {
    /* collection name */
    "from": string;
    "localField"?: string;
    "let"?: Record<string, string>;
    "foreignField"?: string;
    /* append field name */
    "as": string;
    "pipeline": ISearch<T>[]
  },
  "$groupBy": string;
  "$sample": {"size": number, "skip"?: number, "chance"?: number};
  "$unwind": string;
  "$count": string;
}> & PrivateISearch;
type PrivateISearch = Partial<{
  "$context": string;
}>;

abstract class ArangoBaseRepository<T extends ArangoBaseDocument>
  implements Partial<OnModuleDestroy>
{
  collection: string;
  db: Database;
  indexes?: { field: string; type: string; name?: string }[];

  get database() {
    return {
      db: this.db,
      collection: this.collection,
    };
  }

  constructor(
    @Inject('db') db: Database,
    @Inject('collection') collection: string,
    indexes?: { field: string; type: string }[],
  ) {
    this.collection = collection;
    this.db = db;
    this.indexes = indexes;
  }

  onModuleDestroy() {
    return this.db?.close();
  }

  private async createIndexes() {
    if (!this.indexes?.length) {
      return;
    }

    const collection = await this.db.collection(this.collection);

    const existingIndexes = await collection.indexes();
    const indexesToAttach = this.indexes.filter(
      ({ field: indexToCreate }) =>
        !existingIndexes.find((existingIndex) => {
          return (
            (existingIndex as PersistentIndex).fields.indexOf(
              indexToCreate as string,
            ) !== -1
          );
        }),
    );

    await Promise.all(
      indexesToAttach.map((indexToAttach) => {
        return collection.ensureIndex({
          type: indexToAttach.type as 'persistent',
          fields: [indexToAttach.field],
          name: indexToAttach.name ? `${indexToAttach.name}` : indexToAttach.field,
          unique: false
        });
      })
    );
  }

  async start() {
    const actualCollections = await this.db
    .listCollections()
    .then((collections: CollectionMetadata[]) =>
      collections.map((col) => col.name)
    );

    actualCollections.indexOf(this.collection) === -1 &&
    (await this.db.collection(this.collection).create());

    await this.createIndexes();

    return this;
  }

  /**
   * This function takes in an array of JSON, string, or object
   * elements (docs) and a collection string as parameters. It then
   * creates a query to insert the docs into the specified collection.
   * If successful, it returns an ArrayCursor. If unsuccessful, it logs
   * an error message with the collection name and error message to the
   * console and returns undefined.
   */
  insert(docs: T[]): Promise<ArrayCursor<T>> & ToArray<T> {
    const { db, collection } = this.database;
    return insertMany(db, collection, docs);
  }

  /**
   * This function deletes documents from a given collection in an
   * Arango database. It takes an array of strings (keys) and the name
   * of the collection as parameters. It then creates a query to remove
   * the documents from the collection. If the query is successful, it
   * returns the result of the query, otherwise it logs an error with
   * the collection name and error message.
   */
  async delete(doc: string, filter?: string): Promise<ArrayCursor> {
    const { db, collection } = this.database;
    return await removeDocument(db, collection, doc, filter);
  }

  /**
   * This function updates a document in an ArangoDB collection.
   * The function first creates a payload containing the key and
   * fields to update. It then creates a query string using this
   * payload and the collection name. It then attempts to run this
   * query using Arango's db.query() method, and if successful, returns
   * it. If unsuccessful, it logs an error with details about the query
   * and collection.
   */
  async update(
    keyToUpdate: string,
    filter: string,
    fieldsToUpdate: Record<string, unknown> | string,
    options?: Record<string, unknown>
  ): Promise<ArrayCursor<T>> {
    let payload = ''
    , query = '';
    if (keyToUpdate) {
      payload = JSON.stringify({
        _key: keyToUpdate.replace(`${this.collection}/`, ''),
        ...(fieldsToUpdate as Record<string, unknown>)
      });
      query = `UPDATE ${payload} in ${this.collection}`;
    } else {
      payload = typeof fieldsToUpdate === 'string'
      ? fieldsToUpdate
      : JSON.stringify(fieldsToUpdate);
      query = `FOR doc IN ${this.collection}
        FILTER ${filter}
        UPDATE doc WITH ${payload} IN ${this.collection}`;
    }
    if (options && Object(options).keys?.length)
      query += ` OPTIONS ${JSON.stringify(options)}`;

    return this.db.query(query);
  }

  async upsert<T>(
    filter: Record<string, unknown> | string,
    fieldsToInsert: Record<string, unknown> | string,
    fieldsToUpdate: Record<string, unknown> | string,
    options?: Record<string, unknown>
  ): Promise<ArrayCursor<T> | void> {
    const payloadFilter = typeof filter === 'string' ? filter : JSON.stringify(filter)
    , payloadUpdate = typeof fieldsToUpdate === 'string'
    ? fieldsToUpdate
    : JSON.stringify(fieldsToUpdate)
    , payloadInsert = typeof fieldsToInsert === 'string'
    ? fieldsToInsert
    : JSON.stringify(fieldsToInsert);
    let query = `UPSERT ${payloadFilter} INSERT ${payloadInsert} UPDATE ${payloadUpdate} IN ${this.collection}`;

    if (options && Object(options).keys?.length)
      query += ` OPTIONS ${JSON.stringify(options)}`;

    return this.db.query(query);
  }

  async upsertMultiple<T>(
    docs: Record<string, unknown>[],
    fieldToMap: string
  ): Promise<ArrayCursor<T> | void> {
    const query = `
      FOR doc in [${docs.map((d) => JSON.stringify(d))}]
      UPSERT { "${fieldToMap}": doc.${fieldToMap} }
      INSERT doc
      UPDATE doc
      IN '${this.collection}'
    `;

    return this.db.query(query);
  }

  /**
   * This function executes a raw AqlQuery and
   * returns an ArrayCursor of type T if successful.
   * If an error occurs, it logs the error message and
   * query to the console.
   */
  async rawQuery<Item extends Dict = T>(
    query: AqlQuery
  ): Promise<ArrayCursor<Item>> {
    return this.db.query(query);
  }

  /**
   * This function retrieves the number of documents in a collection
   */
  async count(query?: string) {
    const { db, collection } = this.database;
    return await count(db, collection, query);
  }

  /**
   * This function retrieves the list of matched documents
   */
  @PreventInjections()
  findMany<Item extends Dict = T>(
    params: ISearch<T>
  ): Promise<ArrayCursor<Item>> & ToArray<Item> {
    const { db, collection } = this.database;
    return findMany<Item, T>(db, collection, params);
  }

  /**
   * This function retrieves single document or null
   */
  @PreventInjections()
  findOne<Item extends Dict = T>(params: ISearch<T>) {
    const { db, collection } = this.database;
    return findOne<Item, T>(db, collection, params);
  }

  /* @experimental */
  @PreventInjections()
  aggregate<Item extends Dict = T>(
    params: ISearch<T>[]
  ): Promise<ArrayCursor<Item>> & ToArray<Item> {
    const { db, collection } = this.database;
    return aggregate<Item, T>(db, collection, params);
  }
}

// Chainable
function appendPostExec<T extends ArangoBaseDocument>(
  promise: Promise<T | ArrayCursor<T>>
) {
  return new Proxy(promise, {
    get(
      target: Promise<ArrayCursor<T>>,
      prop: keyof typeof promise & "toArray"
    ) {
      // toArray & extend the rest
      if (prop === "toArray")
        return async function () {
          return (await target).all();
        };

      if (typeof target[prop] === "function" && typeof prop === "string")
        // @ts-expect-error
        return target[prop]?.bind?.(target);

      if (typeof prop === "string")
        return (target as Promise<ArrayCursor<T>>)[prop];

      throw new Error("Unsupported method");
    }
  }) as Promise<ArrayCursor<T>> & ToArray<T>
}

function executeQuery<Item extends Dict>(database: Database, query: string) {
  return appendPostExec<Item>(database.query(query));
}

// find, count & pipeline execution methods
async function count(
  db: Database,
  collection: string,
  query?: string,
): Promise<number> {
  const queryFilter = !query ? '' : `FILTER ${query}`;
  return (
    await (
      await db.query(`
        RETURN FIRST(
          FOR doc IN ${collection}
            ${queryFilter}
            COLLECT WITH COUNT INTO length
            RETURN length
        )
      `)
    ).all()
  )[0];
}

function aggregate<Item extends Dict, Query extends ArangoBaseDocument>(
  database: Arg0<typeof executeQuery>,
  collection: string,
  pipeline: ISearch<Query>[],
) {
  pipeline.forEach(p => p?.$sample && append(p.$sample, {"chance": 0.5, "skip": $abs(100 * $random())}))
  const query = serializePipeline(collection, pipeline);
  return executeQuery<Item>(database, query);
}

function findMany<Item extends Dict, Query extends ArangoBaseDocument>(
  services: Arg0<typeof select>,
  collection: Arg1<typeof select>,
  params: Omit<ISearch<Query>, "$lookup" | keyof PrivateISearch>,
) {
  return select<Item, Query>(services, collection, params);
}

async function findOne<Item extends Dict, Query extends ArangoBaseDocument>(
  services: Arg0<typeof select>,
  collection: Arg1<typeof select>,
  params: Omit<ISearch<Query>, "$lookup" | keyof PrivateISearch>,
) {
  $assign(params, { "$limit": 1 });
  const items = await findMany<Item, Query>(
    services,
    collection,
    params
  ).toArray();
  return items[0] ?? null;
}

// CRUD
function select<Item extends Dict, Query extends ArangoBaseDocument>(
  database: Arg0<typeof executeQuery>,
  collection: string,
  params: Omit<ISearch<Query>, "$lookup" | keyof PrivateISearch>,
) {
  if (params?.$sample)
    append(params.$sample, {"chance": 0.5, "skip": $abs(100 * $random())})
  const query = serializePipeline(collection, [params]);
  return executeQuery<Item>(database, query);
}

function insertMany<T extends ArangoBaseDocument>(
  database: Arg0<typeof executeQuery>,
  collection: string,
  docs: T[],
): Promise<ArrayCursor<T>> & ToArray<T> {
  const query = `
    FOR doc IN ${JSON.stringify(docs)}
    INSERT doc IN ${collection}
    RETURN NEW
  `;

  return executeQuery<T>(database, query);
}

async function removeDocument(
  database: Database,
  collection: string,
  doc: string,
  filter?: string,
): Promise<ArrayCursor> {
  let query = `REMOVE DOCUMENT('${doc}') IN ${collection}`;

  if (filter)
    query = `FOR doc IN ${collection} FILTER ${filter} REMOVE doc IN ${collection}`;

  return database.query(query);
}
