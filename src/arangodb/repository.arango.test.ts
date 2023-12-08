import {
  aggregate,
  ArangoBaseRepository,
  count,
  findMany,
  findOne,
  insertMany
} from './repository.arango';
import type { Database } from 'arangojs';
import { initArangoDatabase } from './db.arango';
import { toArray } from '../async';
import { randomUUID } from 'crypto';
import { arangoDbUrl } from '../config';
import type { ArangoBaseDocument } from './db.types';
import { project } from '../object';

const {from: $from} = Array

type TestDocument = ArangoBaseDocument & {
  "name": string,
  "optional"?: string|null
  "array"?: {k: number}[]
};

describe(ArangoBaseRepository.name, () => {
  describe(ArangoBaseRepository.prototype.delete.name, () => {
    it.todo('delete');
  });

  describe(ArangoBaseRepository.prototype.update.name, () => {
    it.todo('update');
  });

  describe(ArangoBaseRepository.prototype.upsert.name, () => {
    it.todo('upsert');
  });

  describe(ArangoBaseRepository.prototype.upsertMultiple.name, () => {
    it.todo('upsertMultiple');
  });

  describe(ArangoBaseRepository.prototype.aggregate.name, () => {
    it.todo('aggregate');
  });
});

describe.only('arango functions', () => {
  let db: Database;
  let mocks: TestDocument[] = [];
  const collection = 'tests';
  const filterField = "filter";

  beforeAll(async () => {
    db = await initArangoDatabase({ url: arangoDbUrl, databaseName: 'test' });
    if (!(await db.collections()).some((col) => col.name === collection))
      await db.createCollection(collection);

    mocks = [
      { "name": randomUUID(), "optional": filterField, "array": [{k: 1}, {k: 2}] },
      { "name": randomUUID(), "optional": filterField, "array": [{k: 3}, {k: 5}] },
      { "name": randomUUID(), "optional": filterField, "array": [{k: 4}, {k: 6}] },
      { "name": randomUUID(), "optional": randomUUID(), "array": [{k: 1}, {k: 2}, {k: 5}] }
    ] as TestDocument[];
    await insertMany(db, collection, mocks);
  });

  afterAll(async () => {
    await db.collection(collection).drop();
  });

  describe(count.name, () => {
    it('count empty collection', async () => {
      expect(await count(db, collection)).toBe(mocks.length);
    });

    it('count', async () => {
      const countMocks = [
        { "name": randomUUID() },
        { "name": randomUUID() },
      ] as TestDocument[];
      await insertMany(db, collection, countMocks);

      expect(await count(db, collection)).toBe(
        mocks.length + countMocks.length
      );
    });

    it('count with filter', async () => {
      const filterName = randomUUID()
        , mocks = [
        { "name": filterName },
        { "name": randomUUID() },
      ] as TestDocument[]
      , insertedCursor = (await insertMany(db, collection, mocks))
      , inserted = await toArray(insertedCursor);

      mocks.forEach((mock) =>
        expect(inserted).toContainEqual(
          expect.objectContaining({
            ...mock,
            name: mock.name,
            _id: expect.any(String),
            _key: expect.any(String),
            _rev: expect.any(String),
          }),
        ),
      );
      expect(await count(db, collection, `doc.name == "${filterName}"`)).toBe(1);
    });
  });

  describe(findMany.name, () => {
    it('findMany with query', async () => {
      const findMocks = await findMany<TestDocument, TestDocument>(
        db,
        collection,
        { "$match": { "optional": filterField }, "$project": {"name": 1, "optional": 1} },
      ).toArray();


      mocks.slice(0, -1).forEach((m) => expect(
        findMocks
      ).toContainEqual(project(m, {"name": 1, "optional": 1})))
      expect(mocks.slice(0, -1).length).toStrictEqual(findMocks.length);
    });
  });

  describe(findOne.name, () => {
    it('findOne & $project', async () => {
      const mock = await findOne<TestDocument, TestDocument>(
        db,
        collection,
        {
          "$match": { "optional": filterField },
          "$project": {"optional": 1, "whole": "LENGTH(doc.whole)"}
        },
      );

      expect(mock).toStrictEqual({"optional": filterField, "whole": 0});
    });
  });

  describe(aggregate.name, () => {
    it("aggregate $lookup", async () => {
      const pipe = await aggregate<TestDocument, TestDocument>(
        db,
        collection,
        [
          {"$match": {"optional": filterField}},
          {"$lookup": {
            "from": collection,
            "localField": "optional",
            "foreignField": "optional",
            "as": "whole",
            "pipeline": [
              {"$match": {}},
              {"$project": {"name": 1}}
            ]
          }},
          {"$project": {"optional": 1, "whole": "LENGTH(doc.whole)"}}
        ]
      ).toArray();

      expect(pipe).toStrictEqual([
        {"optional": filterField, "whole": 3},
        {"optional": filterField, "whole": 3},
        {"optional": filterField, "whole": 3}
      ]);
    });

    it("aggregate $count", async () => {
      const [$count] = await aggregate<{"count": number}, TestDocument>(
        db,
        collection,
        [
          {"$match": {"optional": filterField}},
          {"$count": "count"}
        ]
      ).toArray();

      expect($count).toStrictEqual({"count": 3});
    });

    it("aggregate $unwind", async () => {
      const unwined = await aggregate<{k: number}, TestDocument>(
        db,
        collection,
        [
          {"$match": {"optional": filterField}},
          {"$unwind": "array"}
        ]
      ).toArray();

      expect(
        unwined.sort((a,b) => a.k - b.k)
      ).toStrictEqual($from({length: 6}, (_, k) => ({k: k + 1})));
    });
  });

  describe(insertMany.name, () => {
    it('insertMany', async () => {
      const mocks = [
        { "name": randomUUID() },
        { "name": randomUUID() },
      ] as TestDocument[]
      , insertedCursor = (await insertMany(db, collection, mocks))
      , inserted = await toArray(insertedCursor);

      mocks.forEach((mock) =>
        expect(inserted).toContainEqual(
          expect.objectContaining({
            ...mock,
            name: mock.name,
            _id: expect.any(String),
            _key: expect.any(String),
            _rev: expect.any(String),
          }),
        ),
      );
    });
  });
});
