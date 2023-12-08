import { performance } from 'perf_hooks'
import { histogram } from './prom-client'
import type { Logger } from './ts-utils.types'

export {
  durate,
  timer
}

const now = performance.now.bind(performance)

function durate<F extends (...args: any[]) => Promise<any>>(logger: Logger, fn: F) {
  const { name } = fn
  , metric = histogram({
    name: 'exec_duration_ms',
    help: 'Duration of method/function execution in ms',
    labelNames: ['fn', 'ok'],
  })

  return (async (...args: Parameters<F>) => {    
    const start = now()

    try {
      const r = await fn(...args),
      duration = now() - start

      /* istanbul ignore next */
      logger?.info({
        "fn": name,
        duration
      })

      metric.labels({ fn: name, ok: 1 }).observe(duration);

      return r

    } catch(e) {
      const duration = now() - start
      /* istanbul ignore next */
      logger?.info({
        "fn": name,
        duration
      })  
      
      metric.labels({ fn: name, ok: 0 }).observe(duration);

      throw e
    }
  }) as F
}

function timer() {
  const start = now()
  , end = () => now() - start

  return end
}