import type { falsy } from "./ts-utils.types";

export {
  nop2,
  idfn,
  isTruthy,
  nop,
  nopPromise,
  pipe,
  invoke,
  isDefined
};

/** @example
 * ```typescript
 * const: number[] = [undefined, 1].filter(isTruthy)
 * ```
 */
function isTruthy<T>(x: T): x is Exclude<T, falsy> {
  return !!x
}

function isDefined<T>(source: T): source is Exclude<T, undefined> {
  return source !== undefined
}

function idfn<T>(x: T): T {
  return x
}

function nop(...args: any[]): void|never|undefined
function nop() {}

function nop2() {
  return nop
}

function nopPromise(...args: any[]): Promise<void|never|undefined>
async function nopPromise() {}

function pipe<A, R>(value: A, fn1: (v: A) => R): R 
function pipe<A, V1, R>(value: A, fn1: (v: A) => V1, fn2: (v: V1) => R): R 
function pipe<A, V1, V2, R>(value: A, fn1: (v: A) => V1, fn2: (v: V1) => V2, fn3: (v: V2) => R): R 
function pipe<A, R>(value: A, fn1: (v: A) => any, ...fns: [...Array<(v: any) => any>, (v: unknown) => R]): R 
function pipe() {
  const {length} = arguments
  let value = arguments[0]

  for (let a = 1; a < length; a++)
    value = arguments[a](value)

  return value
}

function invoke<T>(fn: () => T): T {
  return fn()
}
