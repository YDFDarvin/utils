import {
  createServer,
  Server
} from "http";
import { sleep } from "./async";
import { invoke } from "./fn";
import { closePropagator } from "./nest";
import { checkApp } from "./nest-check";
import { metrics } from "./prom-client";
import type {
  Arg0,
  Arg1
} from "./ts-utils.types";

export {
  createWealth
};

function createWealth(
  appPromise: Promise<Arg0<typeof checkApp>>,
  opts: Arg1<typeof checkApp> & {
    "port": number
  }
) {
  const {port} = opts
  , server = createServer(async (req, res) => {
    try {
      if (req.method === "GET") {
        const {
          pathname,
          searchParams
        } = new URL(`http://localhost${req.url}`)
        , query = Object.fromEntries(searchParams)

        switch (pathname) {
          case "/healthcheck":
            return res.writeHead(201).end();

          case "/metrics": {
            return res
            .writeHead(200, {
              'Content-Type': 'text/plain',
            })
            .end(await metrics());
          }

          case "/liveness": {
            let appResolved = 1

            try {
              await Promise.race([appPromise, invoke(async () => {
                await sleep(1)
                appResolved = 0
              })])
            } catch (_) {
              appResolved = -1
            }

            if (appResolved !== 1)
              return res.writeHead(
                appResolved === 0 ? 425 : 500
              ).end()

            const status = await checkApp(await appPromise, query)

            return res
            .writeHead(status.ok ? 200 : 425)
            .end(JSON.stringify(status))
          }
        }
      }

      return res.writeHead(404).end()
    } catch (e) {
      console.error(e)
      return res.writeHead(500).end(`${e}`)
    }
  })

  process.nextTick(() => server.listen(port))

  closePropagator({"app": server})

  return Object.assign(server, {
    stop() {
      return stopServer(server)
    }
  })
}

function stopServer(server: Pick<Server, "close">) {
  return new Promise<typeof server>((res, rej) => server.close(e => e ? rej(e) : res(server)))
}