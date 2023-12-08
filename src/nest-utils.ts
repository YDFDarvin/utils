export class IntervalSequence {
  id: undefined|NodeJS.Timeout = undefined
  prom: undefined|Promise<void> = undefined

  constructor(
    public fn: () => unknown,
    public timeout: number
  ){}

  start() {
    if (this.timeout > 0) {
      const wrapped = async () => {
        let r: () => void

        if (this.prom)
          return

        this.prom = new Promise<void>(res => r = res)
        .then(() => this.prom = undefined)

        try {
          await this.fn()
        } catch(e) {}

        //@ts-ignore
        r()
        this.id = setTimeout(wrapped, this.timeout)
      }

      //TODO Consider immediate start with `wrapped()`
      setTimeout(wrapped, this.timeout)
    }

    return this
  }

  async stop() {
    await this.prom

    const {id} = this

    if (id) {
      clearTimeout(id)
      this.id = undefined
    }

    this.prom = undefined

    return this
  }
}