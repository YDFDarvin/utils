import type { Projection } from "mongodb";
import {
  MongoClient,
  ObjectId
} from "mongodb";
import {
  add,
  bulkRun,
  findFutureTask,
  finish,
  getAndUpdateAbandoned,
  keep,
  redo,
  remove,
  retry,
  signMany,
  Statused,
  STATUS_DONE,
  STATUS_ERROR,
  STATUS_FATAL,
  STATUS_NEW,
  STATUS_PENDING,
  take
} from ".";
import { fill } from "../array";
import {
  collect2map,
  sleep,
  toArray
} from "../async";
import { dbUrl } from "../config";
import { appendCollection, CollectionWriteable } from "../mongo-ops";
import type {
  Dict,
  Id,
  OrArray
} from "../ts-utils.types";

type AddressId = Id<"address">
type TxHash = Id<"tx">
type BlockHash = Id<"block">
type TaskArguments = {
  "address": AddressId
  "directTx": TxHash
}
// type TaskMeta = {
//   "block_hash": BlockHash
//   "blockHeight": number
// }
type TaskSchema = Statused<TaskArguments & {
  "sources"?: Array<{"tx_hash": TxHash}>
}>

type TestSchema = TaskSchema & {
  "report"?: number[]
}

const collections = {} as {
  "taskCollection": CollectionWriteable<TestSchema>
}
, projection = {"_id": 0, "address": 1, "directTx": 1}

let mongo: MongoClient

beforeAll(async () => {
  mongo = await new MongoClient(dbUrl).connect()

  collections.taskCollection = await appendCollection(mongo.db(), "task_registry")
})

afterAll(async () => await mongo.close())

describe("tasker", () => {
  const addresses = [
    "test-monitor-a0",
    "test-monitor-a1",
    "test-monitor-a2"
  ] as AddressId[]
  , directTxs = [
    "test-monitor-t0",
    "test-monitor-t1",
    "test-monitor-t2",
  ] as TxHash[]
  , tasks: TaskArguments[] = [
    {"address": addresses[0], "directTx": directTxs[0]},
    {"address": addresses[0], "directTx": directTxs[1]},
    {"address": addresses[0], "directTx": directTxs[2]},
    {"address": addresses[1], "directTx": directTxs[0]},
  ]
  , match = {"address": {"$in": addresses}}

  it("Cleanup", async () => {
    await flushDb()
    expect(await getStamp()).toStrictEqual({})
  })

  describe(add.name, () => {
    beforeEach(async () => await flushDb())

    it("No tasks somehow", async () => expect(
      //@ts-ignore
      await add(collections.taskCollection, {"immediate": false}, [])
    ).toBe(null))

    it("Create t0", async () => expect(await add(collections.taskCollection, {"immediate": false, "id": true}, [
      tasks[0]
    ])).toMatchObject([
      tasks[0]
    ]))

    it("Register t0, t1 and then duplicate t0 and register t2 and t3", async () => {
      expect(await add(collections.taskCollection, {"immediate": false, "id": true},
        [tasks[0], tasks[1]]
      )).toMatchObject(
        [tasks[0], tasks[1]]
      )

      const before = await getStamp()

      expect(await add(collections.taskCollection, {"immediate": true, "id": true},
        [tasks[0], tasks[2], tasks[3]]
      )).toMatchObject(
        [tasks[2], tasks[3]]
      )

      const after = await getStamp()

      expect(before).toStrictEqual({
        [addresses[0]]: [{
          "directTx": directTxs[0],
          "status": STATUS_NEW,
          "updatedAt": expect.any(Date)
        }, {
          "directTx": directTxs[1],
          "status": STATUS_NEW,
          "updatedAt": expect.any(Date)
        }]
      })

      expect(after).toStrictEqual({
        [addresses[0]]: [{
          "directTx": directTxs[0],
          "status": STATUS_NEW,
          "updatedAt": expect.any(Date)
        }, {
          "directTx": directTxs[1],
          "status": STATUS_NEW,
          "updatedAt": expect.any(Date)
        }, {
          "directTx": directTxs[2],
          "status": STATUS_PENDING,
          "updatedAt": expect.any(Date)
        }],
        [addresses[1]]: {
          "directTx": directTxs[0],
          "status": STATUS_PENDING,
          "updatedAt": expect.any(Date)
        }
      })

      expect(
        (after[addresses[0]] as TaskSchema[])
        .slice(0, (before[addresses[0]] as TaskSchema[]).length)
      ).toStrictEqual(
        before[addresses[0]]
      )
    })

    it("Add finished changes nothing", async () => {
      await add(collections.taskCollection, {"immediate": true, "id": true},
        [tasks[0]]
      ).then(tasked => Promise.all(
        tasked!.map(task =>
          finish(collections.taskCollection,
            {"force": true, "projection": false},
            {"ok": true, task, "result": {
              "sources": [{"tx_hash": "some_tx_hash" as TxHash}]
            }}
          )
        )
      ))

      const before = await getStamp();

      expect(await add(
        collections.taskCollection, {"immediate": true, "id": true},
        [tasks[0]]
      )).toStrictEqual(null)

      const after = await getStamp();

      expect(after).toStrictEqual(before)
    })

    it("Add also without check", async () => {
      const added1  = await add(collections.taskCollection, {"immediate": false, "id": true}, [tasks[0]])
      , added2 = await add(collections.taskCollection, {"immediate": false, "id": true}, [null], [tasks[0]])
      , records = await collections.taskCollection.find(tasks[0]).toArray()

      expect({added1, added2, records}).toMatchObject({
        "added1": [tasks[0]],
        "added2": [tasks[0]],
        "records": [tasks[0], tasks[0]]
      })
    })
  })

  describe(finish.name, () => {
    beforeEach(async () => await flushDb())

    it("Unregistered `done` not rewrites", async () => expect(await finish(collections.taskCollection,
      {"force": false, "projection": true},
      {"ok": true, "task": tasks[0], "result": {"report": [1]}})
    ).toBe(null))

    it("Force done", async () => expect(await finish(collections.taskCollection,
      {"force": true, "projection": true},
      {"ok": true, "task": tasks[0], "result": {"report": [1]}})
    ).toMatchObject({
      ...tasks[0],
      "report": [1],
      "status": STATUS_DONE
    }))

    it("Force error", async () => expect(await finish(collections.taskCollection,
      {"force": true, "projection": {"_id": 0}},
      {"ok": false, "task": tasks[0], "result": {"error": "reason"}}
    )).toStrictEqual({
      ...tasks[0],
      "error": "reason",
      "status": STATUS_ERROR,
      "updatedAt": expect.any(Date)
    }))

    it("Silent forced done", async () => {
      expect(await finish(collections.taskCollection,
        {"force": true, "projection": false},
        {"ok": true, "task": tasks[0], "result": {"report": [1]}})
      ).toBe(null)

      expect(await getStamp()).toStrictEqual({
        [addresses[0]]: {
          "directTx": directTxs[0],
          "report": [1],
          "status": STATUS_DONE,
          "updatedAt": expect.any(Date)
        }
      })
    })

    it("Silent unreg done", async () => {
      expect(await finish(collections.taskCollection,
        {"force": false, "projection": false},
        {"ok": true, "task": tasks[0], "result": {"report": [1]}})
      ).toBe(null)

      expect(await getStamp()).toStrictEqual(
        {}
      )
    })

    it("Additional props", async () => {
      const task = tasks[0]
      , taskWithMeta = {
        ...task,
        "blockHeight": 1,
        "block_hash": "h1" as BlockHash
      }

      //@ts-expect-error
      await add(collections.taskCollection, {"immediate": true, "id": false}, [taskWithMeta])

      const finishResult = await finish(collections.taskCollection,
        {"force": false, "projection": {"_id": 0}},
        {"ok": true, task, "result": {
          "sources": [],
        }}
      )
      expect(finishResult).toStrictEqual({
        ...taskWithMeta,
        "status": STATUS_DONE,
        "sources": [],
        "updatedAt": expect.any(Date)
      })
    })

    it("Double finish", async () => {
      const task = tasks[0]
      , result = {"report": [1]} as Pick<TestSchema, "report">
      , finishing = (force: boolean) => finish(collections.taskCollection,
        {force, "projection": {"_id": 0, "updatedAt": 1}},
        {"ok": true, task, result}
      )
      , first = await finishing(true)
      , second = await finishing(false)

      expect({first, second}).toStrictEqual({
        "first": {"updatedAt": expect.any(Date)},
        "second": null
      })
    })

    // GLBA-1022
    it("GLBA-1022 The new and old results are the same", async () => {
      const {taskCollection} = collections
      , task = tasks[0]
      , result = {"report": [1]} as Pick<TestSchema, "report">
      , returnBefore = await finish(
        taskCollection,
        { "force": true, "projection": true },
        { "ok": true, task, result },
      )
      , recordsBefore = await taskCollection.find(task).toArray()
      , redid = await redo(taskCollection, task)
      , took = await take(
        taskCollection,
        {"limit": 100, "projection": true, "match": task}
      )
      , returnAfter = await finish(
        taskCollection,
        { "force": false, "projection": true },
        { "ok": true, task, result },
      )
      , recordsAfter = await taskCollection.find(task).toArray()

      expect({
        redid,
        returnAfter,
        recordsAfter
      }).toStrictEqual({
        "redid": 1,
        "returnAfter": {
          ...returnBefore,
          "retries": 0,
          "updatedAt": took![0].updatedAt
        },
        "recordsAfter": [{
          ...recordsBefore[0],
          "retries": 0,
          "updatedAt": took![0].updatedAt
        }]
      })
    })

    // GLBA-1022
    it("GLBA-1022 Result-error-result ping-pong", async () => {
      const {taskCollection} = collections
      , task = tasks[0]
      , err = {"e": "somehow"}
      , result = {"report": [1]} as Pick<TestSchema, "report">
      , returnBefore = await finish(
        taskCollection,
        { "force": true, "projection": true },
        { "ok": true, task, result },
      )
      , recordsBefore = await taskCollection.find(task).toArray()
      , redid = await redo(taskCollection, task)

      await take(
        taskCollection,
        {"limit": 100, "projection": true, "match": task}
      )
      await finish(
        taskCollection,
        { "force": false, "projection": true },
        { "ok": false, task, "result": err },
      )

      const retried = await retry(taskCollection, {
        "max": 100,
        "timeout": 0,
      }, {}, {})
      , tookError = await take(
        taskCollection,
        {"limit": 100, "projection": true, "match": task}
      )
      , returnAfter = await finish(
        taskCollection,
        { "force": false, "projection": true },
        { "ok": true, task, result },
      )
      , recordsAfter = await taskCollection.find(task).toArray()

      expect({
        redid,
        retried,
        returnAfter,
        recordsAfter,
      }).toStrictEqual({
        "redid": 1,
        "retried": {
          "fataled": 0,
          "retried": 1
        },
        "returnAfter": {
          ...returnBefore,
          "retries": 1,
          "updatedAt": tookError?.[0].updatedAt,
          ...err
        },
        "recordsAfter": [{
          ...recordsBefore[0],
          "retries": 1,
          "updatedAt": tookError?.[0].updatedAt  ,
          ...err
        }]
      })
    })
  })

  describe(remove.name, () => {
    beforeAll(async () => await flushDb())
    beforeEach(() => Promise.all([
      // New
      add(collections.taskCollection, {"immediate": false, "id": false}, [tasks[0]]),
      // Pending
      add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[1]]),
      // Done
      finish(collections.taskCollection, {"force": true, "projection": false}, {"ok": true, "task": tasks[2], "result": {"report": [1]}}),
      // Error
      finish(collections.taskCollection, {"force": true, "projection": false}, {"ok": false, "task": tasks[3], "result": {"report": [1]}})
    ]))

    it("Remove without force keeps pending", async () => {
      const before = await getStamp();

      expect(await remove(collections.taskCollection,
        {"force": false}
      , tasks)).toBe(3)

      const after = await getStamp();

      before

      expect(after).toEqual({
        [addresses[0]]: expect.objectContaining({
          "directTx": tasks[1].directTx
        })
      })
    })

    it("Remove with force", async () => {
      expect(await remove(collections.taskCollection,
        {"force": true}
      , tasks)).toBe(4)

      expect(await getStamp()).toStrictEqual({})
    })
  })

  describe(take.name, () => {
    beforeEach(async () => await flushDb())

    it("Returns actual record", async () => {
      const {taskCollection} = collections
      , added = await add(taskCollection, {"immediate": false, "id": true}, [tasks[0]])
      , records = await taskCollection.find(match).toArray()
      , taken = await take(taskCollection, {"limit": 100, "projection": true, match})

      expect(taken).toStrictEqual([
        {
          ...added![0],
          "updatedAt": expect.any(Date)
        }
      ])
      expect(+taken![0].updatedAt).toBeGreaterThan(+records[0].updatedAt)
    })

    it("Take capable", async () => {
      await Promise.all([
        add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[0]]),
        add(collections.taskCollection, {"immediate": false, "id": false}, [tasks[1], tasks[2], tasks[3]])
      ])

      expect(await take(collections.taskCollection, {"limit": 2, "projection": true, match}))
      .toHaveLength(2)
    })

    it("Available less than possible", async () => {
      await Promise.all([
        add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[0]]),
        add(collections.taskCollection, {"immediate": false, "id": false}, [tasks[1]])
      ])

      expect(await take(collections.taskCollection, {"limit": 2, "projection": true, match}))
      .toHaveLength(1)
    })

    it("Nothing to do", async () => {
      add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[0]]),

      expect(await take(collections.taskCollection, {"limit": 2, "projection": true, match}))
      .toBe(null)
    })

    /** #177 */
    it("#177 Take per address explicitly", async () => {
      await add(collections.taskCollection, {"immediate": false, "id": false}, tasks)

      const takens = await Promise.all(
        addresses.map(address => take(collections.taskCollection,
          {"match": {address}, "limit": 10, "projection": true}
        ))
      )

      expect(takens.map(t => t?.length ?? 0)).toStrictEqual(
        addresses.map(address =>
          tasks.filter(t => t.address === address)
          .length
        )
      )
    })

    /** #177 */
    it("#177 Take with wId", async () => {
      await add(collections.taskCollection, {"immediate": false, "id": false}, tasks)

      const {length} = addresses
      , signs = fill(length * 2, () => new ObjectId().toString())
      , takens = await Promise.all(
        signs.map((jid, i) =>
          signMany(collections.taskCollection,
            {jid, "match": {"address": addresses[i % length]}, "force": !!(i % 2)}
          )
        )
      )
      , expected = [
        ...addresses.map(address =>
          tasks.filter(t => t.address === address)
          .length
        ),
        ...addresses.map(address =>
          tasks.filter(t => t.address === address)
          .length
        ),
      ].map((v, i) => i > 2 ? (i % 2) * v : v)

      expect(takens).toStrictEqual(expected)
      expect(await getStamp()).toStrictEqual(await collect2map(
        tasks.map(task => ({
          ...task,
          "status": STATUS_PENDING,
          "jid": expect.any(String),
          "updatedAt": expect.any(Date)
        })),
        //@ts-expect-error
        "address", false
      ))
    })
  })

  describe(retry.name, () => {
    beforeAll(async () => {
      await flushDb()

      await Promise.all([
        add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[0]]),
        finish(collections.taskCollection, {"force": true, "projection": false}, {
          "task": tasks[1],
          "ok": false,
          "result": {"e": "err"}
        })
      ])

      await sleep(500)

      await Promise.all([
        add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[2]]),
        finish(collections.taskCollection, {"force": true, "projection": false}, {
          "task": tasks[3],
          "ok": false,
          "result": {"e": "err"}
        })
      ])
    })

    it("1. first", async () => {
      const counts = await retry(collections.taskCollection, {
        "max": 2,
        "timeout": 500
      }, {}, {})

      expect(await getItems()).toStrictEqual([
        {...tasks[0], "retries": 1, "status": STATUS_NEW},
        {...tasks[1], "retries": 1, "status": STATUS_NEW},
        {...tasks[2], "status": STATUS_PENDING},
        {...tasks[3], "status": STATUS_ERROR},
      ])
      expect(counts).toStrictEqual({
        "fataled": 0,
        "retried": 2
      })
    })

    it("2. Immediate attempt to retry", async () => {
      const counts = await retry(collections.taskCollection, {
        "max": 2,
        "timeout": 500
      }, undefined, undefined)

      expect(await getItems()).toStrictEqual([
        {...tasks[0], "retries": 1, "status": STATUS_NEW},
        {...tasks[1], "retries": 1, "status": STATUS_NEW},
        {...tasks[2], "status": STATUS_PENDING},
        {...tasks[3], "status": STATUS_ERROR},
      ])
      expect(counts).toStrictEqual({
        "fataled": 0,
        "retried": 0
      })
    })

    it("3. Retry after the next round", async () => {
      await sleep(500)

      const counts = await retry(collections.taskCollection, {
        "max": 2,
        "timeout": 500
      }, undefined, {})

      expect(await getItems()).toStrictEqual([
        {...tasks[0], "retries": 1, "status": STATUS_NEW},
        {...tasks[1], "retries": 1, "status": STATUS_NEW},
        {...tasks[2], "retries": 1, "status": STATUS_NEW},
        {...tasks[3], "retries": 1, "status": STATUS_NEW},
      ])

      expect(counts).toStrictEqual({
        "fataled": 0,
        "retried": 2
      })
    })

    it("4. Retries top means fatal", async () => {
      const {"length": taken} = (await take(collections.taskCollection, {match, "limit": 1000, "projection": true}))!
      , before = await getItems()

      await sleep(100)

      const counts = await retry(collections.taskCollection, {
        "max": 1,
        "timeout": 1
      }, {}, undefined)
      , after = await getItems()

      expect({
        taken,
        counts,
        before,
        after
      }).toStrictEqual({
        "taken": 4,
        "counts": {
          "retried": 0,
          "fataled": 4
        },
        "before": [
          {...tasks[0], "retries": 1, "status": STATUS_PENDING},
          {...tasks[1], "retries": 1, "status": STATUS_PENDING},
          {...tasks[2], "retries": 1, "status": STATUS_PENDING},
          {...tasks[3], "retries": 1, "status": STATUS_PENDING},
        ],
        "after": [
          {...tasks[0], "retries": 1, "status": STATUS_FATAL},
          {...tasks[1], "retries": 1, "status": STATUS_FATAL},
          {...tasks[2], "retries": 1, "status": STATUS_FATAL},
          {...tasks[3], "retries": 1, "status": STATUS_FATAL},
        ]
      })
    })

    function getItems() {
      return collections.taskCollection.find({
        "address": {"$in": addresses},
        "directTx": {"$in": directTxs},
      }, {
        "projection": {
          "_id": 0,
          "address": 1,
          "directTx": 1,
          "status": 1,
          "retries": 1
        },
        "sort": {
          "address": 1,
          "directTx": 1
        }}).toArray()
    }
  })

  describe(getAndUpdateAbandoned.name, () => {
    beforeEach(async () => await flushDb())

    it("Nothing is abandoned", async () => {
      const {taskCollection} = collections
      , task = tasks[0]

      await add(taskCollection, {"immediate": false, "id": false}, [task])
      await sleep(100)

      const abandoned = await toArray(getAndUpdateAbandoned(taskCollection, {
        "projection": {"address": 1, "_id": 0},
        "timeout": 10000,
        "limit": 100,
        "match": undefined,
        "jid": "1"
      }))

      expect(abandoned).toStrictEqual([])
    })

    it("There's one abandoned due to timeout", async () => {
      const {taskCollection} = collections
      , task = tasks[0]

      await add(taskCollection, {"immediate": false, "id": false}, [task])
      await sleep(100)

      const abandoned = await toArray(getAndUpdateAbandoned(taskCollection, {
        "projection": {"address": 1, "_id": 0},
        "timeout": 100,
        "limit": 100,
        "match": undefined,
        "jid": "1"
      }))

      expect(abandoned).toStrictEqual([{
        "address": task.address
      }])
    })

    it("Abandoned renewed only once", async () => {
      const {taskCollection} = collections
      , task = tasks[0]

      await add(taskCollection, {"immediate": false, "id": false}, [task])
      await sleep(100)

      const abandoned = await toArray(getAndUpdateAbandoned(taskCollection, {
        "projection": {"address": 1, "_id": 0},
        "timeout": 100,
        "match": undefined,
        "jid": "1",
        "limit": 100
      }))
      , abandonedDuplication = await toArray(getAndUpdateAbandoned(taskCollection, {
        "projection": {"address": 1, "_id": 0},
        "timeout": 1000,
        "match": undefined,
        "jid": "2",
        "limit": 100
      }))

      await sleep(150)

      const abandonedNext = await toArray(getAndUpdateAbandoned(taskCollection, {
        "projection": {"address": 1, "_id": 0},
        "timeout": 100,
        "match": undefined,
        "jid": "2",
        "limit": 100
      }))

      expect({abandoned, abandonedDuplication, abandonedNext}).toStrictEqual({
        "abandoned": [{
          "address": task.address
        }],
        "abandonedDuplication": [],
        "abandonedNext": [{
          "address": task.address
        }],

      })
    })

    //GLBA-1180 
    it("GLBA-1180 Parallel", async () => {
      const parallelCount = 2
      , timeout = 500
      , {taskCollection} = collections

      await add(taskCollection, {"immediate": false, "id": false}, tasks)
      await sleep(1.5 * timeout)

      const abandoneds = await Promise.all(fill(parallelCount , async i => (await toArray(getAndUpdateAbandoned(taskCollection, {
          "projection": {"address": 1, "_id": 0},
          timeout,
          "limit": 100,
          "match": undefined,
          "jid": `${i}`
        })))
        .length
      ))
      , abandonedCount = abandoneds.reduce((acc, v) => acc + v)

      expect({
        abandonedCount,
      }).toStrictEqual({
        "abandonedCount": 2,
      })
    })
  })

  describe(findFutureTask.name, () => {
    beforeEach(async () => await flushDb())

    it("Nothing to do", async () => expect(
      await findFutureTask(collections.taskCollection, {"max": 10, "timeout": 10000}, {"address": tasks[0].address})
    ).toBe(null))

    it("New is a future task in any conditions", async () => {
      const {taskCollection} = collections
      , [{_id}] = (await add(taskCollection, {"immediate": false, "id": true}, [tasks[0]]))!

      expect([
        await findFutureTask(taskCollection, {"max": 0, "timeout": 0}, {"address": tasks[0].address}),
        await findFutureTask(taskCollection, {"max": 100, "timeout": 10000}, {"address": tasks[0].address})
      ]).toStrictEqual([
        {_id},
        {_id}
      ])
    })

    it("Done is not a future task in any conditions", async () => {
      const {taskCollection} = collections

      await Promise.all([
        finish(taskCollection, {"force": true, "projection": false}, {
          "task": tasks[0],
          "ok": true,
          "result": {
            "sources": []
          }
        }),
        finish(taskCollection, {"force": true, "projection": false}, {
          "task": tasks[0],
          "ok": true,
          "result": {
            "retries": 5,
            "sources": []
          }
        }),
      ])

      expect([
        await findFutureTask(taskCollection, {"max": 0, "timeout": 0}, {"address": tasks[0].address}),
        await findFutureTask(taskCollection, {"max": 100, "timeout": 10000}, {"address": tasks[0].address})
      ]).toStrictEqual([
        null,
        null
      ])
    })

    it("Future of pendings", async () => {
      const {taskCollection} = collections

      await add(taskCollection, {"immediate": true, "id": false}, [tasks[0]])

      const counts = await retry(taskCollection, {"timeout": 1, "max": 100}, undefined, undefined)

      await take(
        taskCollection,
        {"limit": 100, "projection": {}, "match": tasks[0]}
      )

      const future1 = await findFutureTask(taskCollection, {"max": 1, "timeout": 1}, {"address": tasks[0].address})
      , future2 = await findFutureTask(taskCollection, {"max": 10, "timeout": 10000}, {"address": tasks[0].address})

      expect({counts, future1, future2}).toStrictEqual({
        "counts": {
          "fataled": 0,
          "retried": 1,
        },
        "future1": null,
        "future2": {"_id": expect.any(ObjectId)}
      })
    })
  })

  describe(redo.name, () => {
    beforeEach(async () => await flushDb())

    describe("Re-do", () => {
      it("Redo is for 'done' one", async () => {
        const {taskCollection} = collections
        , task = tasks[0]
        , {address} = task
  
        await finish(taskCollection, {"force": true, "projection": false}, {
          "ok": true,
          task,
          "result": {
            "report": [0]
          }
        })
  
        const before = await getStamp()
        , redos = (await Promise.all([
          redo(taskCollection, task),
          redo(taskCollection, task)
        ])).sort()
        , after = await getStamp()
  
        expect({
          "stamp": after,
          redos
        }).toStrictEqual({
          "redos": [0, 1],
          "stamp": {
            ...before,
            [address]: {
              ...before[address],
              "retries": 0,
              "status": 0,
              "updatedAt": expect.any(Date)
            }
          }
        })
  
        //@ts-expect-error
        expect(+after[address].updatedAt).toBeGreaterThan(+before[address].updatedAt)
      })
  
      it("Redo is not for other statuses", async () => {
        const {taskCollection} = collections
  
        await Promise.all([
          add(taskCollection, {"immediate": false, "id": false}, [tasks[0]]),
          add(taskCollection, {"immediate": true, "id": false}, [tasks[1]]),
          finish(taskCollection, {"force": true, "projection": false}, {
            "ok": false,
            "task": tasks[0],
            "result": {
              "report": [0]
            }
          })
        ])
  
        const before = await getStamp()
        , redid = await redo(collections.taskCollection, {"$or": [tasks[0], tasks[1], tasks[2]]})
        , after = await getStamp()
  
        expect({
          "stamp": after,
          redid
        }).toStrictEqual({
          "stamp": before,
          "redid": 0
        })
      })
  
      it("Redo can be used as reset", async () => {
        const {taskCollection} = collections
  
        await Promise.all([
          add(taskCollection, {"immediate": false, "id": false}, [tasks[0]]),
          add(taskCollection, {"immediate": true, "id": false}, [tasks[1]]),
          finish(taskCollection, {"force": true, "projection": false}, {
            "ok": false,
            "task": tasks[0],
            "result": {
              "report": [0]
            }
          })
        ])
  
        const before = await getStamp({ "updatedAt": 0 })
        , redid = await redo(
          collections.taskCollection,
          {"$or": [tasks[0], tasks[1], tasks[2]]},
          {"force": true}
        )
        , redone = await Promise.all([
          add(taskCollection, {"immediate": false, "id": false}, [tasks[0]]),
          add(taskCollection, {"immediate": true, "id": false}, [tasks[1]]),
          finish(taskCollection, {"force": true, "projection": false}, {
            "ok": false,
            "task": tasks[0],
            "result": {
              "report": [0]
            }
          }),
          take(
            taskCollection,
            {"limit": 100, "projection": true, "match": tasks[1]}
          )
        ]).then(() => true).catch(() => false)
        , after = await getStamp({ "updatedAt": 0, "retries": 0 })
  
        expect({
          "stamp": after,
          redid,
          redone,
        }).toStrictEqual({
          "stamp": before,
          "redid": 2,
          "redone": true
        })
      })
  
      it("Redo doesn't create new tasks", async () => {
        const before = await getStamp()
        , redid = await redo(collections.taskCollection, tasks[0])
        , after = await getStamp()
  
        expect({
          "stamp": after,
          redid
        }).toStrictEqual({
          "stamp": before,
          "redid": 0
        })
      })
  
    })

    describe("Re-set", () => {
      for (const force of [false, true]) it(`${force ? "with" : "without"} force`, async () => {
        const {taskCollection} = collections
        , directTx = "without force" as TxHash
        , prepared = await Promise.all([
          add(taskCollection, {"immediate": false, "id": true},
            [{"address": "new" as AddressId, directTx}]
          ),
          add(taskCollection, {"immediate": true, "id": true},
            [{"address": "pending" as AddressId, directTx}]
          ),
          finish(taskCollection, {"force": true, "projection": true},
            {"ok": true, "task": {"address": "done", directTx}, "result": {"report": [1]}}
          ),
          finish(taskCollection, {"force": true, "projection": true},
            {"ok": false, "task": {"address": "err", directTx}, "result": {"e": "e"}}
          ),
          // TODO Fatal for logical coverage
        ])
        , before = await taskCollection.find({directTx}, {
          "sort": {"address": 1},
          "projection": {
            "_id": 0,
          }
        }).toArray()
        , redone = await redo(taskCollection, {}, {"reset": true, force})
        , after = await taskCollection.find({directTx}, {
          "sort": {"address": 1},
          "projection": {
            "_id": 0,
          }
        }).toArray()
        , updates = after.reduce((acc, item, i) => {
          const bef = before[i]
          , {address} = item

          if (bef.address !== address)
            throw Error("...")

          const updated = item.updatedAt > bef.updatedAt

          acc[address] = updated

          return acc
        }, {} as Dict)

        prepared; redone

        expect({updates, redone}).toStrictEqual({
          "updates": {
            "new": true,
            "done": true,
            "err": true,
            "pending": force,
            // TODO Fatal for logical coverage
          },
          "redone": prepared.length - (force ? 0 : 1)
        })
      })
    })
  })

  describe(keep.name, () => {
    beforeEach(async () => await flushDb())

    it("demo", async () => {
      const {taskCollection} = collections
      , timeout = 500
      , address = "keep-demo" as AddressId
      , tasks = [
        {address, "directTx": "manual-stop"},
        {address, "directTx": "auto-stop"},
        {address, "directTx": "staled"}
      ]

      await add(taskCollection, {"immediate": true, "id": false}, tasks, [
        {"jid": "keep-demo-manual-stop"},
        {"jid": "keep-demo-auto-stop"},
        // undefined
      ])

      const stopKeep = keep(taskCollection, {timeout}, {"jid": "keep-demo-manual-stop"})
      keep(taskCollection, {timeout}, {"jid": "keep-demo-auto-stop"})

      await sleep(1.5 * timeout)

      const notKept = await retry(taskCollection, {timeout, "max": 0}, undefined, undefined)

      await finish(taskCollection, {"force": false, "projection": true}, {
        "ok": true,
        "task": {address, "directTx": "auto-stop"},
        "result": {}
      })

      const getKept = () => taskCollection.find({address}, {
        "projection": {
          _id: 0,
          "directTx": 1,
          "jid": 1,
          "status": 1,
          "updatedAt": 1
        },
        "sort": {
          "directTx": 1
        }
      }).toArray()
      , before = await getKept()

      await sleep(timeout)

      stopKeep()

      const after = await getKept()

      expect({notKept, before, after}).toStrictEqual({
        "notKept": {
          "fataled": 0,
          "retried": 1
        },
        "before": [
          {"directTx": "auto-stop", "status": 1},
          {"directTx": "manual-stop", "status": 2},
          {"directTx": "staled", "status": 0}
        ].map(expect.objectContaining),
        "after": [
          before[0],
          {...before[1], "updatedAt": after[1].updatedAt},
          before[2]
        ]
      })

      expect(+after[1].updatedAt).toBeGreaterThan(+before[1].updatedAt)
    })
  })

  describe("Scenarios", () => {
    beforeEach(async () => await flushDb())

    it("Register then done", async () => {
      await add(collections.taskCollection, {"immediate": true, "id": false}, [tasks[0]])

      expect(await finish(collections.taskCollection,
        {"force": false, "projection": {"_id": 1}},
        {"ok": true, "task": tasks[0], "result": {"report": [1]}})
      ).toHaveProperty("_id")
    })
  })

  describe(bulkRun.name, () => {
    beforeEach(async () => await flushDb())

    it("Nothing to do", async () => expect(await bulkRun(collections.taskCollection,
      {"limit": 2, "projection": {}, match},
      () => ({})
    )).toBe(null))

    it("Concurrent", async () => {
      await add(collections.taskCollection, {"immediate": false, "id": false}, tasks)

      await Promise.all([
        //@ts-expect-error
        bulkRun(collections.taskCollection, {"limit": 2, projection, match},
          (_: TaskArguments) => sleep(200).then(() =>({"report": [1]}))),
        //@ts-expect-error
        bulkRun(collections.taskCollection, {"limit": 2, projection, match},
          ({address}: TaskArguments) => sleep(300).then(() => address === addresses[1] ? Promise.reject("Because I can") : {"report": [2]}))
      ])

      expect(await collect2map(collections.taskCollection
      .aggregate([
        {$match: {$or: tasks}},
        {$group: {
          _id: "$status",
          "count": {$sum: 1}
        }},
        //@ts-expect-error
      ]), "_id", false)
      ).toStrictEqual({
        "-1": {"count": 1},
        "1": {"count": 3},
      })
    })
  })

  function getStamp(projection?: Projection<TestSchema>): Promise<Record<
    TaskSchema["address"],
    OrArray<Omit<TaskSchema, "address">>
  >> {
    return collect2map(
      collections.taskCollection.find({"$or": [
        {"address": {"$in": addresses}},
        {"directTx": {"$in": directTxs}}
      ]}, {"projection": {"_id": 0, ...projection}}),
      //@ts-expect-error
      "address",
      false
    )
  }

  function flushDb() {
    return collections.taskCollection.deleteMany({})
  }
})

