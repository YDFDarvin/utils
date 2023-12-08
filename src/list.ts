import type {
  Mutate
} from "./ts-utils.types"

export {
  makeQueue,
  makeStack
}

type List<T> = {value?: T, n?: List<T>}

const Done = {"done": true as const, "value": undefined}

function makeQueue<T>() {
  let head = {} as List<T>
  , tail = head
  , size = 0

  return {
    get length() {
      return size
    },
    push(value: T) {
      tail = head.value === undefined
      ? head = {value}
      : tail.n = {value}

      return size++
    },
    forEach(cb: (value: T) => unknown) {
      if (!size)
        return
      
      let pointer = head as List<T>|undefined
      cb(pointer!.value!)

      while (pointer = pointer!.n)
        cb(pointer.value!)
    },
    [Symbol.iterator]() {
      return {
        next() {
          if (!size)
            return Done

          size--

          const $return = head as Mutate<List<T>, IteratorYieldResult<T>>

          head = head.n || {}

          delete $return.n 

          return $return   
        }
      }
    }
  }
}

function makeStack<T>() {
  let head = {} as List<T>
  , size = 0

  return {
    get length() {
      return size
    },
    push(value: T) {
      head = head.value === undefined
      ? {value}
      : {
        "n": head,
        value
      }

      return size++
    },
    forEach(cb: (value: T) => unknown) {
      if (!size)
        return
      
      let pointer = head as List<T>|undefined
      cb(pointer!.value!)

      while (pointer = pointer!.n)
        cb(pointer.value!)
    },
    [Symbol.iterator]() {
      return {
        next() {
          if (!size)
            return Done

          size--

          const $return = head as Mutate<List<T>, IteratorYieldResult<T>>

          head = head.n || {}

          delete $return.n 

          return $return   
        }
      }
    }
  }
}
