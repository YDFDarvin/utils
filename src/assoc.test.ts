import {
  accumulatorProducer,
  clear,
  deleteUndefined,
  diff,
  firstKey,
  firstValue,
  getDeep,
  isEmptyObject,
  isMaxProperties,
  iterateRecursive,
  pushToGroup,
  sortKeysAsc,
  tryValues
} from "./assoc"
import type {
  WriteAble,
  falsy
} from "./ts-utils.types"

const {entries: $entries} = Object

describe(sortKeysAsc.name, () => {
  it("Sorted", () => expect($entries(sortKeysAsc({
    "a": 1,
    "b": 2
  }))).toStrictEqual($entries({
    "a": 1,
    "b": 2
  })))

  it("Sort", () => expect($entries(sortKeysAsc({
    "b": 0,
    2: 1,
    10: 2,
    "a": 3
  }))).toStrictEqual($entries({
    10: 2,
    2: 1,
    "a": 3,
    "b": 0
  })))
})

describe(isMaxProperties.name, () => {
  it("empty <= 0", () => expect(isMaxProperties(
    {}, 0
  )).toBe(true))

  it("empty ! <= -1", () => expect(isMaxProperties(
    {}, -1
  )).toBe(false))

  it("1-prop <= 2", () => expect(isMaxProperties(
    {"a": 1}, 2
  )).toBe(true))

  it("1-prop ! <= 1", () => expect(isMaxProperties(
    {"a": 0}, 0
  )).toBe(false))
})

describe(clear.name, () => {
  it("demo", () => {
    const target = {"a": 1, "b": 2}
    , result = clear(target)

    expect(result).toStrictEqual({})
    expect(result).toBe(target)
  })
})

describe(isEmptyObject.name, () => {
  it("empty", () => expect(isEmptyObject(
    {}
  )).toBe(true))

  it("not empty", () => expect(isEmptyObject({
    "": undefined
  })).toBe(false))
})

describe(deleteUndefined.name, () => {
  it("demo", () => expect(deleteUndefined({
    "q": 1,
    "u1": undefined,
    "u2": undefined,
    "w": 2,
    "u3": undefined,
    "e": 3
  })).toStrictEqual({
    "q": 1,
    "w": 2,
    "e": 3
  }))
})

describe(diff.name, () => {
  it("flat", () => expect(diff({
    "same": "s",
    "new": "n",
    "mod": 1,
  }, {
    "same": "s",
    "deleted": "d",
    "mod": 2,
  })).toStrictEqual({
    "create": {
      "new": "n"
    },
    "del": {
      "deleted": "d"
    },
    "modify": {
      "mod": 1
    },
    "outdated": {
      "mod": 2
    }
  }))

  it("deep equal", () => expect(diff(
    {"a": {"b": 1}},
    {"a": {"b": 1}},
  )).toBe(null))

  it("same object", () => {
    const obj = {"a": {"b": 1}}

    expect(diff(obj, obj)).toBe(null)
  })

  it("obvious del", () => {
    const del = {"a": {"b": 1}}

    expect(diff(undefined, del)).toStrictEqual({
      del
    })
  })

  it("obvious new", () => {
    const create = {"a": {"b": 1}}

    expect(diff(create, undefined)).toStrictEqual({
      create
    })
  })
})

describe(firstKey.name, () => {
  it("empty", () => expect(firstKey(
    {}
  )).toBe(undefined))

  it("some", () => expect(firstKey(
    {"b": 2, "a": 1}
  )).toBe("b"))
})

describe(firstValue.name, () => {
  it("empty", () => expect(firstValue(
    {}
  )).toBe(undefined))

  it("some", () => expect(firstValue(
    {"b": 2, "a": 1}
  )).toBe(2))
})

describe(iterateRecursive.name, () => {
  it("d=0", () => expect(Array.from(iterateRecursive(
    0, {"a": 1}
  ))).toStrictEqual([
    {"a": 1}
  ]))

  it("d=1", () => expect(Array.from(iterateRecursive(
    1, {"a": 1, "b": 2}
  ))).toStrictEqual([
    1, 2
  ]))

  it("d=2", () => expect(Array.from(iterateRecursive(
    2, {"r0": null, "r1": {"a": 1, "b": 2}, "r2": {"a": 3, "b": 4}}
  ))).toStrictEqual([
    null, 1, 2, 3, 4
  ]))
})

describe(getDeep.name, () => {
  it("0", () => expect(getDeep(
    {"a": 1}, []
  )).toStrictEqual(
    {"a": 1}
  ))

  it("2", () => expect(getDeep(
    {"a": {"b": {"c": 1}}}, ["a", "b"]
  )).toStrictEqual(
    {"c": 1}
  ))

  it("too deep", () => expect(getDeep(
    {"a": "abc"}, ["a", "length"]
  )).toStrictEqual(
    "abc"
  ))

  it("def delimiter", () => expect(getDeep(
    {"a": {"b": {"c": 1}}}, "a.b"
  )).toStrictEqual(
    {"c": 1}
  ))

  it("own delimiter", () => expect(getDeep(
    {"a": {"b": {"c": 1}}}, "a b", " "
  )).toStrictEqual(
    {"c": 1}
  ))

  it("direct def delimiter", () => expect(getDeep(
    {"a": {"b": {"c": 1}}}, "a"
  )).toStrictEqual(
    {"b": {"c": 1}}
  ))

  it("direct own delimiter", () => expect(getDeep(
    {"a": {"b": {"c": 1}}}, "a", " "
  )).toStrictEqual(
    {"b": {"c": 1}}
  ))
})

describe(pushToGroup.name, () => {
  describe("demo", () => {
    const input = [{
      "directTx": "d1",
      "funds": {"score": 10},
      "flowAmount": 10
    }, {
      "directTx": "d1",
      "funds": {"score": 10},
      "flowAmount": 20
    }, {
      "directTx": "d1",
      "funds": {"score": 20},
      "flowAmount": 10
    }, {
      "directTx": "d2",
      "funds": {"score": 20},
      "flowAmount": 10
    }]
    , output = [{
      "directTx": "d1",
      "funds": {"score": 10},
      "flowAmount": 30,
    }, {
      "directTx": "d1",
      "funds": {"score": 20},
      "flowAmount": 10,
    }, {
      "directTx": "d2",
      "funds": {"score": 20},
      "flowAmount": 10,
    }]
    , merger = (acc: falsy|WriteAble<typeof input[number]>, item: typeof input[number]) => {
      if (!acc)
        return {...item}
      
      acc.flowAmount = (acc.flowAmount ?? 0) + item.flowAmount

      return acc
    }

    it("groupId as proj", () => {
      const store = {} as any
  
      input.forEach(item => pushToGroup(
        store,
        ["directTx", ["funds", "score"]],
        merger,
        item
      ))
  
      expect(
        Array.from(iterateRecursive(2, store))
      ).toStrictEqual(output)
    })
  
    it("groupId as function", () => {
      const store = {} as any
  
      input.forEach(item => pushToGroup(
        store,
        (item) => [item.directTx, item.funds.score],
        merger,
        item
      ))
  
      expect(
        Array.from(iterateRecursive(2, store))
      ).toStrictEqual(output)
    })

    it("destroy", () => {
      const store = {} as any
      input.forEach(item => pushToGroup(
        store,
        (item) => [item.directTx, item.funds.score],
        merger,
        item
      ))
  
      expect({
        "output": Array.from(iterateRecursive(2, store, true)),
        store
      }).toStrictEqual({
        output,
        "store": {}
      })
    })
  })
})

describe(accumulatorProducer.name, () => {
  it("demo", () => {
    const accumulator = accumulatorProducer({
      $push<T>(acc: undefined|T[], item: T) {
        if (item === undefined)
          return acc

        if (!acc)
          return [item]

        acc.push(item)

        return acc
      },
      $addToSet<T>(acc: undefined|Set<T>, item: T) {
        return item === undefined ? acc 
        : (acc || new Set<T>())
        .add(item)
      }
    })
    , cmd = {
      "a": "$push",
      "b": "$addToSet"
    } as const

    let acc = {} as {
      "a": number[]
      "b": Set<string>
    }

    acc = accumulator(cmd, undefined as undefined | typeof acc, {"a": undefined, "b": undefined})
    acc = accumulator(cmd, acc, {"a": "1", "b": 1})
    acc = accumulator(cmd, acc, {"a": "1", "b": 1})

    expect(acc).toStrictEqual({
      "a": ["1", "1"],
      "b": new Set([1])
    })
  })
})

describe(tryValues.name, () => {
  it("empty", () => expect(tryValues(
    {}, ["a", "b"]
  )).toStrictEqual([
    "a", "b"
  ]))

  it("some", () => expect(tryValues(
    {"a": 1}, ["a", "b"]
  )).toStrictEqual([
    1, "b"
  ]))

})