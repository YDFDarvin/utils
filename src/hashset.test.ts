import { fill } from "./array";
import {
    addNew,
    HashSetStore,
    makeHashMap,
    makeHashSet,
    setHas
} from "./hashset";

const {
  floor: $floor,
  round: $round,
  random: $random
} = Math

describe(addNew.name, () => {
  it("demo", () => {
    const hashset: HashSetStore<string> = []
    , prime = 2
    , first = addNew(hashset, prime, "a")
    , second = addNew(hashset, prime, "a")
    , other = addNew(hashset, prime, "b")

    expect({
      first, second, other
    }).toStrictEqual({
      "first": true,
      "second": false,
      "other": true
    })
  })
})

describe(setHas.name, () => {
  it("demo", () => {
    const hashset: HashSetStore<string> = []
    , prime = 2

    addNew(hashset, prime, "a")

    expect({
      "a": setHas(hashset, prime, "a"),
      "b": setHas(hashset, prime, "b"),
      "c": setHas(hashset, prime, "c"),
    }).toStrictEqual({
      "a": true,
      "b": undefined,
      "c": false
    })
  })
})

describe(makeHashSet.name, () => {
  const array = ["a", "b", "c"]
  , hashSet = makeHashSet(997, array)

  it("construct", () => expect(
    hashSet.has("b")
  ).toBe(true))

  it(hashSet.addNew.name, () => expect(
    hashSet.addNew("b")
  ).toBe(false))

  it(hashSet.forEach.name, () => {
    let i = 0

    hashSet
    .add(array[0])
    .forEach(() => i++)

    expect(i).toBe(array.length)
  })

  it(hashSet.add.name, () => expect(
    hashSet.add("x").has("x")
  ).toBe(true))

  describe("size", () => {
    it("0", () => expect(
      makeHashSet(997)
      .size
    ).toBe(0))

    it("from construct", () => expect(
      makeHashSet(997, ["a", "b", "a"])
      .size
    ).toBe(2))

    it("after add", () => {
      const hashSet = makeHashSet(997)
      .add("a")
      .add("b")
      .add("a")

      expect(hashSet.size).toBe(2)
    })

    it("construct and add", () => {
      const hashSet = makeHashSet(997, ["a", "b", "a"] as string[])
      .add("a")
      .add("c")

      expect(hashSet.size).toBe(3)
    })
  })
})

describe(makeHashMap.name, () => {
  it("has", () => {
    const hashMap = makeHashMap<string, number>(2)
    .set("a", 1)

    expect([
      hashMap.has("a"),
      hashMap.has("b"),
      hashMap.has("c")
    ]).toStrictEqual([
      true,
      undefined,
      false
    ])
  })

  it("forEach", () => {
    const hashMap = makeHashMap<string, number>(3)
    .set("a", 1)
    .set("a", 2)
    .set("b", 3)

    let count = 0, sum = 0

    hashMap.forEach(v => {
      count++
      sum += v
    })

    expect({count, sum}).toStrictEqual({
      "count": 2,
      "sum": 5
    })
  })

  it("delete", () => {
    const hashMap = makeHashMap<string, number>(2)
    .set("a", 1)
    .set("c", 1)

    expect([
      hashMap.delete("a"),
      hashMap.delete("a"),
      hashMap.delete("c"),
      hashMap.delete("c")
    ]).toStrictEqual([
      true,
      true, //Better to have `false` here but not atm
      true,
      false
    ])
  })

  it("get", () => {
    const hashMap = makeHashMap<string, number>(2)
    .set("a", 1)

    expect([
      hashMap.get("a"),
      hashMap.get("a", 2),
      hashMap.get("b"),
      hashMap.get("b", 2),
      hashMap.get("c"),
      hashMap.get("c", 2),
    ]).toStrictEqual([
      1,
      1,
      undefined,
      2,
      undefined,
      2
    ])
  })

  it("clear", () => {
    const hashMap = makeHashMap<string, number>(2)
    .set("a", 1)

    hashMap.clear()

    expect(hashMap.has("a")).toBe(undefined)
  })
})


describe("compare", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  , {"length": alphaLength} = alphabet
  , minLength = 26
  , maxLength = 65
  , randomStr = () => {
    const length = minLength + $round((maxLength - minLength) * $random())

    let str = ""

    for (let l = length; l-->0;)
      str += alphabet[$floor(alphaLength * $random())]

    return str
  }
  , randomStr2 = () => {
    const length = minLength + $round((maxLength - minLength) * $random())

    let str = []

    for (let l = 0; l < length; l++)
      str[l] = alphabet[$floor(alphaLength * $random())]

    return str.join("")
  }
  , length = 1*10**6
  , dict: Record<string, unknown> = {}
  , map = new Map<string, unknown>()
  , hashMap = makeHashMap(997)
  // , clusterMap = makeClustered(1000)

  let keys: string[]
  , otherKeys: string[]

  it("rand with str", () => {
    keys = fill(length, randomStr)
  })

  it("rand with arr", () => {
    otherKeys = fill(length, randomStr2)
  })

  describe("add", () => {
    it("dict", () => {
      for (let e = length; e-->0;)
        dict[keys[e]] = []
    })

    it("map", () => {
      for (let e = length; e-->0;)
        map.set(keys[e], [])
    })

    it("hashMap", () => {
      for (let e = length; e-->0;)
        hashMap.set(keys[e], [])
    })

    // it("clusterMap", () => {
    //   for (let e = length; e-->0;)
    //     clusterMap.set(keys[e], [])
    // })
  })

  describe("has", () => {
    it("dict", () => {
      for (let e = length; e-->0;)
        otherKeys[e] in dict
    })

    it("map", () => {
      for (let e = length; e-->0;)
        map.has(otherKeys[e])
    })

    it("hashMap", () => {
      for (let e = length; e-->0;)
        hashMap.has(otherKeys[e])
    })

    // it("clusterMap", () => {
    //   for (let e = length; e-->0;)
    //     clusterMap.has(otherKeys[e])
    // })
  })

  describe("get", () => {
    it("dict", () => {
      for (let e = length; e-->0;)
        dict[otherKeys[e]]
    })

    it("map", () => {
      for (let e = length; e-->0;)
        map.get(otherKeys[e])
    })

    it("hashMap", () => {
      for (let e = length; e-->0;)
        hashMap.get(otherKeys[e])
    })

    // it("clusterMap", () => {
    //   for (let e = length; e-->0;)
    //     clusterMap.get(otherKeys[e])
    // })
  })

  describe("foreach", () => {
    it("dict", () => {
      for (const k in dict) {
        dict[k]
      }
    })

    it("map", () => {
      map.forEach(() => {})
    })

    it("hashMap", () => {
      hashMap.forEach(() => {})
    })

    // it("clusterMap", () => {
    //   clusterMap.forEach(() => {})
    // })
  })

  describe("delete random", () => {
    it("dict", () => {
      for (let e = length; e-->0;)
        delete dict[otherKeys[e]]
    })

    it("map", () => {
      for (let e = length; e-->0;)
        map.delete(otherKeys[e])
    })

    it("hashMap", () => {
      for (let e = length; e-->0;)
        hashMap.delete(otherKeys[e])
    })

    // it("clusterMap", () => {
    //   for (let e = length; e-->0;)
    //     clusterMap.delete(otherKeys[e])
    // })
  })

  describe("delete all", () => {
    it("dict", () => {
      for (let e = length; e-->0;)
        delete dict[keys[e]]
    })

    it("map", () => {
      for (let e = length; e-->0;)
        map.delete(keys[e])
    })

    it("hashMap", () => {
      for (let e = length; e-->0;)
        hashMap.delete(keys[e])
    })

    // it("clusterMap", () => {
    //   for (let e = length; e-->0;)
    //     clusterMap.delete(keys[e])
    // })
  })

  // function makeClustered<K, V>(maxLength: number) {
  //   const store: Array<Map<K, V>> = []

  //   return {
  //     set(k: K, v: V) {
  //       const {length} = store

  //       if (length === 0) {
  //         store[0] = new Map().set(k, v)

  //         return this
  //       }

  //       let s = 0
  //       for (; s < length; s++) {
  //         const map = store[s]

  //         if (!map.has(k))
  //           continue

  //         map.set(k, v)

  //         return this
  //       }

  //      ;(
  //       store[length - 1].size < maxLength
  //       ? store[length - 1]
  //       : store[length] = new Map()
  //      )
  //      .set(k, v)

  //      return this
  //     },

  //     has(k: K) {
  //       const {length} = store

  //       for (let s = 0; s < length; s++)
  //         if (store[s].has(k))
  //           return true

  //       return false
  //     },

  //     get(k: K) {
  //       const {length} = store

  //       for (let s = 0; s < length; s++) {
  //         const map = store[s]

  //         // TODO consider get
  //         if (map.has(k))
  //           return map.get(k)
  //       }

  //       return
  //     },

  //     forEach(cb: (v: V, k: K) => unknown) {
  //       const {length} = store

  //       for (let s = 0; s < length; s++)
  //         store[s].forEach(cb)
  //     },

  //     delete(k: K) {
  //       const {length} = store

  //       for (let s = 0; s < length; s++) {
  //         const map = store[s]

  //         // TODO consider get
  //         if (map.has(k)) {
  //           map.delete(k)

  //           if (map.size === 0) {
  //             if (s === length - 1)
  //               store.length--
  //             else
  //               store[s] = store[length - 1]
  //           }

  //           return true
  //         }
  //       }

  //       return false
  //     }
  //   }
  // }
})
