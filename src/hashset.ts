import type { Nullable } from "./ts-utils.types"

export {
    addNew,
    setHas,
    hashString,
    makeHashSet,
    makeHashMap,
    setForEach
}
export type {
    HashSetStore,
    HashMap,
    SetLikeReadonly,
    MapLikeReadonly,
    SetLike,
    MapLike,
    HashSet
}

type HashSet<T extends string> = {
  readonly "store": HashSetStore<T>
  readonly "size": number
  has(probe: T): undefined|boolean
  // "addNew": (probe: T) => undefined|boolean
  forEach(cb: (item: T) => unknown): void

  add(probe: T): HashSet<T>
  addNew(probe: T): boolean
}

type MapLikeReadonly<K, V> = {
  has(probe: K): undefined|boolean
  get(K: K): undefined|V
  forEach(callbackfn: (value: V, key: K) => void): void;
}

type SetLikeReadonly<T> = {
  "size": number
  has(probe: T): undefined|boolean
  forEach(callbackfn: (value: T, key: T) => void): void;
}

interface SetLike<T> extends SetLikeReadonly<T> {
  add(probe: T): this
}

interface MapLike<K, V> extends MapLikeReadonly<K, V> {
  set(K: K, probe: V): this
}

new Set().forEach

type HashMap<S extends string, V> = {
  store: HashMapStore<S, V>
  has(probe: S): undefined|boolean
  forEach(cb: (item: V, key: S) => unknown): void
  get(probe: S): undefined|V
  get(probe: S, defaultValue: V): V
  set(probe: S, value: V): HashMap<S, V> 
  delete(probe: S): boolean|undefined
  clear(): void
}

type HashSetStore<S extends string> = Array<undefined|Set<S>>
type HashMapStore<S extends string, V> = Array<undefined|Map<S, V>>

/**
 * @param prime Examples: 997, 1009, 9973
 */
function addNew<S extends string>(sets: HashSetStore<S>, prime: number, probe: S) {
  const hash = hashString(prime, probe)
  , set = sets[hash] = sets[hash] ?? new Set()

  if (set.has(probe))
    return false

  set.add(probe)
  
  return true
}

/**
 * @deprecated Use ordinary Set
 * @param prime Examples: 997, 1009, 9973
 */
function makeHashSet<T extends string>(
  prime: number,
  source?: Nullable<T[]>,
) {
  const store: HashSetStore<T> = []

  let size = 0

  if(source)
    for (let s = source.length; s-->0;) 
      addNew(store, prime, source[s]) && size++
        

  const obj = {
    /* @deprecated Implement forEach */
    store,
    size,
    has(probe: T) { return setHas(this.store, prime, probe) },
    addNew(probe: T) {
      const added = addNew(this.store, prime, probe)

      added && this.size++

      return added
    },
    add(probe: T) {
      this.addNew(probe)
      
      return obj
    },
    forEach(cb: (item: T, K: T) => unknown) {
      return setForEach(this.store, cb)
    }
  }

  return obj
}

/**
 * @deprecated Use ordinary `Map`
 * @param prime Examples: 997, 1009, 9973
 */
function makeHashMap<S extends string, V>(
  prime: number
) {
  const store: HashMapStore<S, V> = []

  const obj = {
    /* @deprecated Implement forEach */
    store,
    has(probe: S) { return mapHas(this.store, prime, probe) },
    forEach(cb: (item: V, key: S) => unknown) {
      return mapForEach(this.store, cb)
    },
    get(probe: S, defaultValue?: V) {
      return get(this.store, prime, probe, defaultValue)
    },
    set(probe: S, value: V) {
      set(this.store, prime, probe, value)
      return this
    },
    delete(probe: S) {
      return mapDelete(this.store, prime, probe)
    },
    clear() {
      store.length = 0
    }

  } as HashMap<S, V> 

  return obj
}


function setHas<S extends string>(sets: HashSetStore<S>, prime: number, probe: S) {
  return sets[hashString(prime, probe)]?.has(probe)
}

function mapHas<S extends string>(sets: HashMapStore<S, unknown>, prime: number, probe: S) {
  const bunch = sets[hashString(prime, probe)]

  if (!bunch)
    return bunch

  return bunch.has(probe)
}

function setForEach<S extends string>(sets: HashSetStore<S>, cb: (item: S, key: S) => unknown) {
  for (let a = sets.length; a-->0;) {
    const set = sets[a]

    if (!set)
      continue

    for (const item of set)
      cb(item, item)
  }
}

function mapForEach<S extends string, V>(store: HashMapStore<S, V>, cb: (item: V, key: S) => unknown) {
  for (let a = store.length; a-->0;) {
    const bunch = store[a]

    if (!bunch)
      continue

    bunch.forEach((v, k) => cb(v, k))
  }
}

function mapDelete<S extends string>(store: HashMapStore<S, unknown>, prime: number, probe: S) {
  const key = hashString(prime, probe)
  , bunch = store[key] 

  if (!bunch)
    return false

  bunch.delete(probe)

  if (bunch.size === 0)
    delete store[key]

  // TODO cleanup
  return true
}

function set<S extends string, V>(store: HashMapStore<S, V>, prime: number, probe: S, value: V) {
  const key = hashString(prime, probe)
  , bunch = store[key] = store[key] ?? new Map() as NonNullable<typeof store[number]>

  bunch.set(probe, value)

  return store
}

function get<S extends string, V>(store: HashMapStore<S, V>, prime: number, probe: S): undefined|V
function get<S extends string, V>(store: HashMapStore<S, V>, prime: number, probe: S, defaultValue: V): V
function get<S extends string, V>(store: HashMapStore<S, V>, prime: number, probe: S, defaultValue?: V) {
  const key = hashString(prime, probe)
  , bunch = store[key]

  if (defaultValue === undefined)
    return bunch?.get(probe)

  if (!bunch) {
    store[key] = new Map().set(probe, defaultValue)

    return defaultValue
  }
  
  const value = bunch.get(probe)

  if (value !== undefined)
    return value

  bunch.set(probe, defaultValue)

  return defaultValue
}

/**
 * @param prime Examples: 997, 1009, 9973
 */
function hashString(prime: number, probe: string) {
  let sum = 0
  for (let i = probe.length; i-->0;)
    sum += probe.charCodeAt(i)

  return sum % prime
}
