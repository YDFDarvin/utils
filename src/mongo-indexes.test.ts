import type { Collection, Db } from "mongodb";
import { MongoClient } from "mongodb";
import { sort } from "./array";
import { $all } from "./async";
import { dbUrl } from "./config";
import { nop } from "./fn";
import type {
  IndexData,
  IndexMap
} from "./mongo-indexes";
import {
  aggregateIndexes,
  createIndexes,
  dropIndexes,
  hidingIndex,
  hidingIndexes,
  indexesCheck,
  makeIndexActions,
  normalizeIndexData
} from "./mongo-indexes";
import { insertMany } from "./mongo-ops";
import { recreateCollection } from "./mongo-sync";
import {
  forIn,
  pick
} from "./object";
import type {
  Arg1,
  Dict
} from "./ts-utils.types";

const collections = {} as {
  "indexing": Collection
}

let mongo: MongoClient
, db: Db

const AnyObject = expect.any(Object)

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()

  db = mongo.db()

  collections.indexing = await recreateCollection(db, "indexing")
})
afterAll(async () => await mongo.close())

describe("Indexing", () => {
  describe("Scenario", () => {
    const indexes: Arg1<typeof createIndexes> = {
      "a_1": {"key": {"a": 1}},
      "a_-1": {"key": {"a": -1}},
      "a_-1_b_1": {"key": {
        "a": -1,
        "b": 1
      }},
      "un_b_1": {
        "key": {"b": 1},
        "unique": true,
        "background": true
      }
    }

    beforeAll(async () => {
      await collections.indexing.dropIndexes()
    })

    it(`1. ${createIndexes.name}`, async () => {
      const noCreate = await createIndexes(collections.indexing, {})
      , created = await createIndexes(collections.indexing,
        indexes
      )

      expect({noCreate, created}).toStrictEqual({
        "noCreate": null,
        "created": Object.keys(indexes)
      })
    })

    it(`2. ${aggregateIndexes.name}`, async () => expect(
      await aggregateIndexes(collections.indexing,
        {"$match": {"name": {"$ne": "_id_"}}},
        {"$sort": {"name": 1}}
      )
    ).toEqual(sort(
      Object.entries(indexes)
      .map(([name, data]) => ({
        ...data,
        name,
        "v": 2,
        "usage": {
          "ops": 0,
          "since": expect.any(Date)
        }
      })),
      {"name": 1}
    )))
  })

  it("TODO Text index", async () => {
    await collections.indexing.dropIndexes()

    const created = await createIndexes(collections.indexing, {
      "textProp_text": {
        "key": {"textProp": "text"}
      }
    })
    , got = await aggregateIndexes(collections.indexing, {"$sort": {"name": 1}}, {"$project": {"usage": 0, "v": 0}})

    expect({created, got}).toStrictEqual({
      "created": ["textProp_text"],
      "got": [{
        "name": "_id_",
        "key": {"_id": 1},
      }, {
        "name": "textProp_text",
        "default_language": "english",
        "key": {
          "_fts": "text",
          "_ftsx": 1,
        },
        "language_override": "language",
        "textIndexVersion": 3,
        "weights": {
          "textProp": 1,
        },
      }]
    })
  })
})

describe(createIndexes.name, () => {
  let collection: Collection
  beforeAll(async () => {
    collection = await recreateCollection(db, "indexing")
  })

  beforeEach(() => collection.dropIndexes())

  it("name is from value, than key", async () => {
    const created = await createIndexes(collection, {
      "a": {"key": {"a": 1}},
      "b": {
        "key": {"b": 1},
        //@ts-expect-error
        "name": "c"
      }
    })
    , actual = await aggregateIndexes(collection,
      {"$match": {"name": {"$ne": "_id_"}}},
      {"$sort": {"name": 1}},
      {"$project": {"name": 1}},
    )

    expect({created, actual}).toStrictEqual({
      "created": ["a", "c"],
      "actual": [
        {"name": "a"},
        {"name": "c"}
      ]
    })
  })

  it("duplicated instruction - nothing created", async () => {
    const created = await createIndexes(collection, {
      "a": {"key": {"a": 1}},
      "b": {"key": {"a": 1}}
    })
    .catch(e => e)
    , actual = await aggregateIndexes(collection,
      {"$match": {"name": {"$ne": "_id_"}}},
      {"$sort": {"name": 1}},
      {"$project": {"name": 1}},
    )

    expect({created, actual}).toEqual({
      "created": expect.any(Error),
      "actual": []
    })
  })

  it("duplicated with present", async () => {
    await createIndexes(collection, {
      "a": {"key": {"a": 1}},
    })

    const created = await createIndexes(collection, {
      "c": {"key": {"c": 1}},
      "b": {"key": {"a": 1}},
    }).catch(e => e)
    , actual = await aggregateIndexes(collection,
      {"$match": {"name": {"$ne": "_id_"}}},
      {"$sort": {"name": 1}},
      {"$project": {"name": 1}},
    )

    expect({created, actual}).toEqual({
      "created": expect.any(Error),
      "actual": [
        {"name": "a"}
      ]
    })
  })
})

describe(normalizeIndexData.name, () => {
  it("demo", () => {
    const data = {
      "key": {"k": 1},
      "$comment": "hello world",
      "v": 100500,
      "background": true,
      "hidden": true,
      "false": false,
      "true": true
    }
    , normalized = normalizeIndexData(data)
    , props = Object.getOwnPropertyNames(normalized).sort()

    expect({
      normalized,
      props,
      "hidden": normalized.hidden
    }).toStrictEqual({
      "normalized": {
        "hidden": true, 
        "key": {"k": 1},
        "true": true
      },
      "props": [
        "key",
        "true",
        "hidden",
        "_k"
      ].sort(),
      "hidden": true
    })
  })

  it("check hidden key", () => expect(normalizeIndexData({
    "key": {"k": 1},
    "pr": "1"
  })._k).toBe(normalizeIndexData({
    "pr": "1",
    "key": {"k": 1},
  })._k))

  it.todo("Consider mame hide")
})

describe(dropIndexes.name, () => {
  it("empty", async () => expect(
    await dropIndexes(collections.indexing, {})
  ).toBe(null))

  it("drop vs create", async () => {
    await collections.indexing.dropIndexes()

    const indexes: Dict<IndexData> = {
      "a": {
        "$comment": "1",
        "deprecated": true,
        "key": {"a": 1}
      },
      "b": {
        "$comment": "1",
        "deprecated": true,
        "key": {"b": 1},
        //@ts-expect-error
        "name": "bbb"
      }
    }
    , created = await createIndexes(collections.indexing, indexes)
    , dropped = await dropIndexes(collections.indexing, indexes)
    , left = await aggregateIndexes(collections.indexing, {"$sort": {"name": 1}})

    expect({created, dropped, left}).toEqual({
      "created": ["a", "bbb"],
      "dropped": {
        "a": indexes.a,
        "b": expect.any(Error)
      },
      "left": [{
        "name": "_id_",
        "key": {"_id": 1},
        "usage": {
          "ops": 0,
          "since": expect.any(Date)
        },
        "v": 2
      }, {
        ...pick(indexes.b, ["key",
          //@ts-expect-error
          "name"
        ]),
        "usage": {
          "ops": 0,
          "since": expect.any(Date)
        },
        "v": 2
      }]
    })
  })
})

describe(hidingIndexes.name, () => {
  it("empty", async () => expect(
    await hidingIndexes(collections.indexing, {}, true)
  ).toBe(null))

  it("demo", async () => {
    const indexes: IndexMap = {
      "hid1": {
        "key": {[hidingIndexes.name]: 1},
      },
      "hid2": {
        "key": {[hidingIndexes.name]: -1},
        //@ts-expect-error
        "name": "hid2",
      }
    }
    , indexNames = Object.keys(indexes)
    , collection = collections.indexing

    await $all(forIn(indexes, (v, k) => collection.dropIndex(
      //@ts-expect-error
      v.name || k
    ).catch(nop)))

    const created = await createIndexes(collection, indexes)
    , hides = await hidingIndexes(collection, indexes, true)
    , unhides = await hidingIndexes(collection, indexes, false)

    expect({created, hides, unhides}).toStrictEqual({
      "created": indexNames,
      "hides": indexNames,
      "unhides": indexNames,
    })
  })
})

describe(hidingIndex.name, () => {
  it("demo", async () => {
    const hiddenName = "hid"
    , key = {[hidingIndex.name]: 1}
    , collection = collections.indexing

    await collection.dropIndex(hiddenName).catch(nop)
    const created = await collection.createIndex(key, {"name": hiddenName})
    , hide = await hidingIndex(collection, hiddenName, true)
    , result = await aggregateIndexes(collection, {"$match": {"name": hiddenName}})
    , doubleHide = await hidingIndex(collection, hiddenName, true)
    , unhide = await hidingIndex(collection, hiddenName, false)
    , doubleUnhide  = await hidingIndex(collection, hiddenName, false)

    expect({created, hide, result, doubleHide, unhide, doubleUnhide}).toEqual({
      "created": hiddenName,
      "hide": {
        "ok": 1,
        "hidden_new": true,
        "hidden_old": false
      },
      "result": [{
        "name": hiddenName,
        key,
        "hidden": true,
        "v": 2,
        "usage": {
          "ops": 0,
          "since": expect.any(Date)
        }
      }],
      "doubleHide": {
        "ok": 1,
      },
      "unhide": {
        "ok": 1,
        "hidden_new": false,
        "hidden_old": true
      },
      "doubleUnhide": {
        "ok": 1
      }
    })
  })

  it("absent index", () => expect(
    hidingIndex(collections.indexing, "absent", true)
  ).rejects.toThrow())
})

describe(makeIndexActions.name, () => {
  it("keys order", () => {
    const result = makeIndexActions({
      "ordinary": {"key": {"a": 1, "b": 1}},
      "partial": {"key": {"p": 1}, "partialFilterExpression": {"a": 1, "b": 1}},
      "p2": {"key": {"p": 1}, "partialFilterExpression": {"p": 1}}
    }, {
      "ordinary": {"key": {"b": 1, "a": 1}},
      "partial": {"key": {"p": 1}, "partialFilterExpression": {"b": 1, "a": 1}},
      "p2": {"partialFilterExpression": {"p": 1}, "key": {"p": 1}}
    })

    expect(result).toStrictEqual({
      "change": {
        "ordinary": AnyObject,
        "partial": AnyObject
      }
    })
  })

  it("duplication", () => {
    const result = makeIndexActions({
      "or1": {"key": {"a": 1, "b": 1}},
      "or2": {"key": {"a": 1, "b": 1}},
      "or3": {"key": {"a": 1, "b": 1}},
    }, {
    }, {})

    expect(result).toMatchObject({
      "duplicates": [
        [
          {"name": "or1"},
          {"name": "or2"},
          {"name": "or3"}
        ],
      ]
    })
  })

  describe("ordinary", () => {
    const source = {
      "same": {"key": {"same": 1}},
      "renameNew": {"key": {"rename": 1}},
      "changed": {"key": {"changed": 1}},
      "new": {"key": {"new": 1}},
      "un_same": {"key": {"same": 1}, "unique": true},
      "un_renameNew": {"key": {"rename": 1}, "unique": true},
      "un_changed": {"key": {"changed": 1}, "unique": true},
      "un_new": {"key": {"new": 1}, "unique": true},
    }
    , target = {
      "same": {"key": {"same": 1}},
      "renameOld": {"key": {"rename": 1}},
      "changed": {"key": {"changed": -1}},
      "delete": {"key": {"delete": 1}},
      "un_same": {"key": {"same": 1}, "unique": true},
      "un_renameOld": {"key": {"rename": 1}, "unique": true},
      "un_changed": {"key": {"changed": -1}, "unique": true},
      "un_delete": {"key": {"delete": 1}, "unique": true},
    }

    it("default", () => {
      const result = makeIndexActions(source, target, {})

      expect(result).toEqual(lvl2keyAsName({
        "create": {
          "new": source.new,
          "un_new": source.un_new
        },
        "del":{
          "delete": target.delete,
          "un_delete": target.un_delete
        },
        "rename": {
          "renameOld": {
            ...source.renameNew,
            "name": "renameNew"
          },
          "un_renameOld": {
            ...source.un_renameNew,
            "name": "un_renameNew"
          }
        },
        "change": {
          "changed": {
            ...source.changed,
            "_was": {
              ...target.changed,
              "name": "changed",
            },
          },
          "un_changed": {
            ...source.un_changed,
            "_was": {
              ...target.un_changed,
              "name": "un_changed",
            },
          }
        }
      }))
    })

    it("unique only", () => {
      const result = makeIndexActions(source, target, {"unique": true})

      expect(result).toEqual(lvl2keyAsName({
        "create": {
          "un_new": source.un_new
        },
        "del": {
          "un_delete": target.un_delete
        },
        "rename": {
          "un_renameOld": {
            ...source.un_renameNew,
            "name": "un_renameNew"
          }
        },
        "change": {
          "un_changed": {
            ...source.un_changed,
            "_was": {
              ...target.un_changed,
              "name": "un_changed"
            }
          }
        }
      }))
    })

    it("perf only", () => {
      const result = makeIndexActions(source, target, {"unique": false})

      expect(result).toEqual(lvl2keyAsName({
        "create": {
          "new": source.new,
        },
        "del": {
          "delete": target.delete,
        },
        "rename": {
          "renameOld": {
            ...source.renameNew,
            "name": "renameNew"
          },
        },
        "change": {
          "changed": {
            ...source.changed,
            "_was": {
              ...target.changed,
              "name": "changed"
            },
          },
        }
      }))
    })

    it("unhide ordinary", () => {
      const source = {
        "k": {"key": {"k": 1}},
        "weird1": {"key": {"weird1": 1}, "hidden": true},
        "weird2": {"key": {"weird2": 1}, "hidden": true},
      }
      , target = {
        "k": {"key": {"k": 1}, "hidden": true},
        "weird1": {"key": {"weird1": 1}, "hidden": true},
        "weird2": {"key": {"weird2": 1}},
      }
      , result = makeIndexActions(source, target, {"unique": false})

      expect(result).toStrictEqual(lvl2keyAsName({
        "unhide": {
          "k": {"key": {"k": 1}},
          "weird1": {
            "hidden": true,
            "key": {"weird1": 1}
          }
        }
      }))
    })

    it("hide instead of delete", () => {
      const result = makeIndexActions({
      }, {
        "delete": {"key": {"delete": 1}},
        "hidden": {"key": {"hidden": 1}, "hidden": true}
      }, {"hide": true})

      expect(result).toStrictEqual({
        "hide": {
          "delete": AnyObject
        }
      })
    })
  })

  describe("deprecated", () => {
    it("allow", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "deprecated": true},
        "deprecated": {"key": {"deprecated": 1}, "deprecated": true},
      }, {
        "deprecated": {"key": {"deprecated": 1}},
      }, {"deprecated": true})

      expect(result).toStrictEqual({})
    })

    it("disallow", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "deprecated": true},
        "deprecated": {"key": {"deprecated": 1}, "deprecated": true},
      }, {
        "deprecated": {"key": {"deprecated": 1}},
      }, {"deprecated": false})

      expect(result).toStrictEqual({
        "del": {"deprecated": AnyObject}
      })
    })

    it("disallow only perf", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "deprecated": true, "unique": true},
        "deprecated": {"key": {"deprecated": 1}, "deprecated": true, "unique": true},
      }, {
        "deprecated": {"key": {"deprecated": 1}, "unique": true},
      }, {"deprecated": false, "unique": false})

      expect(result).toStrictEqual({})
    })

    it("hide", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "deprecated": true},
        "depr": {"key": {"depr": 1}, "deprecated": true},
        "depr_hidden": {"key": {"depr_hidden": 1}, "deprecated": true},
      }, {
        "depr": {"key": {"depr": 1}},
        "depr_hidden": {"key": {"depr_hidden": 1}, "hidden": true},
      }, {"deprecated": "hide"})

      expect(result).toStrictEqual({
        "hide": {
          "depr": AnyObject
        }
      })
    })
  })

  describe("experimental", () => {
    it("allow", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "experimental": true},
        "experimental": {"key": {"experimental": 1}, "experimental": true},
      }, {
        "experimental": {"key": {"experimental": 1}},
      }, {"experimental": true})

      expect(result).toStrictEqual({
        "create": {"new": AnyObject}
      })
    })

    it("disallow", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "experimental": true},
        "experimental": {"key": {"experimental": 1}, "experimental": true},
      }, {
        "experimental": {"key": {"experimental": 1}},
      }, {"experimental": false})

      expect(result).toStrictEqual({
        "del": {"experimental": AnyObject}
      })
    })

    it("disallow only unique", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "experimental": true},
        "experimental": {"key": {"experimental": 1}, "experimental": true},
      }, {
        "experimental": {"key": {"experimental": 1}},
      }, {"experimental": false, "unique": true})

      expect(result).toStrictEqual({})
    })

    it("hide", () => {
      const result = makeIndexActions({
        "new": {"key": {"new": 1}, "experimental": true},
        "exper": {"key": {"exper": 1}, "experimental": true},
        "exper_hidden": {"key": {"exper_hidden": 1}, "experimental": true},
      }, {
        "exper": {"key": {"exper": 1}},
        "exper_hidden": {"key": {"exper_hidden": 1}, "hidden": true},
      }, {"experimental": "hide"})

      expect(result).toStrictEqual(lvl2keyAsName({
        "create": {
          "new": {
            "hidden": true,
            "key": {"new": 1},
            "experimental": true
          },
        },
        "hide": {
          "exper": {
            "key": {"exper": 1},
            "experimental": true
          }
        }
      }))
    })    
  })
})

describe(indexesCheck.name, () => {
  const collections = {} as {
    "features": Collection
    "non_unique": Collection
  }

  beforeAll(async () => {
    collections.features = await recreateCollection(db, "features")
    collections.non_unique = await recreateCollection(db, "non_unique")
  })

  describe("partial", () => {
    const indexes/*: Arg1<typeof createIndexes>*/ = {
      "_id_": {
        "key": {"_id": 1}
      },
      "part-a1,b1--a": {
        "key": {
          "a": 1,
          "b": 1
        },
        "partialFilterExpression": {
          "a": {"$type": "string"}
        }
      },
      "part-a1,b1--b": {
        "key": {
          "a": 1,
          "b": 1
        },
        "partialFilterExpression": {
          "b": {"$type": "string"}
        }
      },
      "a1,b1": {
        "key": {
          "a": 1,
          "b": 1
        },
      },
    }
    , one: keyof typeof indexes = "part-a1,b1--a"

    beforeAll(async () => {
      const r = await createIndexes(collections.features, pick(indexes, [one]))

      expect(r).toEqual([one])
    })

    it("vs self", async () => {
      const r = await indexesCheck(collections.features, {
        "part-a1,b1--a": {
          ...indexes["part-a1,b1--a"],
          "partialFilterExpression": indexes["part-a1,b1--a"].partialFilterExpression,
          "key": indexes["part-a1,b1--a"].key
        },
        "_id_": indexes["_id_"]
      }, {"duplicates": 5000})
      expect(r).toStrictEqual({
        "duplicatedCounts": undefined,
        "duplicatesError": undefined,
        "ok": true,
      })
    })

    it("rename", async () => {
      const newName = "part-a1,b1"
      , r = await indexesCheck(collections.features, {
        [newName]: {
          ...indexes["part-a1,b1--a"],
          //@ts-expect-error
          "name": newName
        },
        "_id_": indexes["_id_"]
      }, {})
      
      expect(r).toStrictEqual({
        "duplicatedCounts": undefined,
        "duplicatesError": undefined,
        "ok": true,
        "rename": {
          "part-a1,b1--a": {
            ...indexes["part-a1,b1--a"],
            "name": newName
          }
        },
      })
    })

    it("vs other part", async () => {
      const r = await indexesCheck(collections.features, pick(indexes, ["_id_", "part-a1,b1--b"]), {})
      expect(r).toMatchObject({
        "create": pick(indexes, ["part-a1,b1--b"]),
        "del": pick(indexes, ["part-a1,b1--a"])
      })
    })

    it("vs ordinary", async () => {
      const r = await indexesCheck(collections.features, pick(indexes, ["_id_", "a1,b1"]), {})

      expect(r).toMatchObject({
        "create": pick(indexes, ["a1,b1"]),
        "del": pick(indexes, ["part-a1,b1--a"])
      })
    })
  })

  describe("duplicated", () => {
    beforeEach(async () => await collections.non_unique.deleteMany({}))

    for (const duplicates of [true, 500]) it(`${duplicates}`, async () => {
      const collection = collections.non_unique

      await insertMany(collection, [
        {"a": 1},
        {"a": 1},
        {"b": 1}
      ])

      const indexes = {
        "_id_": {key: {"_id": 1}},
        "un_a": {
          "key": {"a": 1},
          "unique": true,
          "partialFilterExpression": {"a": {"$gte": 0}}
        },
        "un_b": {
          "key": {"b": 1},
          "unique": true,
          "partialFilterExpression": {"b": {"$gte": 0}}
        },
        "un_c": {
          "key": {"c": 1},
          "unique": true,
          "partialFilterExpression": {"c": {"$gte": 0}}
        }
      } 
      , resp = await indexesCheck(collection, indexes, {duplicates})

      expect(resp).toEqual({
        "ok": false,
        "duplicatedCounts": {
          "un_a": {
            "count": 1,
            "total": 2
          },
        },
        "create": {
          "un_a": AnyObject,
          "un_b": AnyObject,
          "un_c": AnyObject,
        }
      })
    })
  })
})

describe(aggregateIndexes.name, () => {
  it("no collection is error", () => expect(
    aggregateIndexes(db.collection("non_existent"))
  ).rejects.toThrow())
})


function lvl2keyAsName<S extends Dict<Dict<Dict>>>(source: S) {
  return forIn(source, v => keyAsName(v, "name"))
}

function keyAsName<S extends Dict<Dict>, K extends string = "name">(source: S, prop: K = "name" as K) {
  return forIn(source, (v, k) => ({
    [prop]: k,
    ...v,
  }))
}
