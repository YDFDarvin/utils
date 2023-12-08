export {
    Liveness
};

type LivenessTarget = {
  liveness: () => unknown
}

const {
  getOwnPropertyNames: $getOwnPropertyNames,
  getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
  defineProperty: $defineProperty
} = Object

/** **NB!** Use only in Service, `RmqController` and `RmqHandlers` support it out of the box */
function Liveness<T extends {"prototype": LivenessTarget}>(Class: T) {
  const {prototype} = Class
  , methods = $getOwnPropertyNames(prototype)

  for (let m = methods.length; m-->0;) {
    const methodName = methods[m]
    , desc = $getOwnPropertyDescriptor(prototype, methodName)!
    , handler: Function = desc.value!

    if (
      typeof handler !== "function"
      || methodName === "liveness"
      || methodName === "constructor"
      || methodName === "onModuleInit"
      || methodName === "onModuleDestroy"
    )
      continue

    const wrapped: typeof handler = async function(this: typeof prototype) {
      await this.liveness()
      return handler.apply(this, arguments)
    }
    
    $defineProperty(wrapped, "name", {"value": methodName})
    desc.value = wrapped

    $defineProperty(prototype, methodName, desc)
  }
}
