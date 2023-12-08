import type { AddressInfo } from "net"
import { invoke } from "./fn"
import type { NestRmqClient, NestRmqService } from "./nest"
import { projectionIncludes } from "./object"
import type { Dict, ProjectStrict } from "./ts-utils.types"

export {
  checkApp
}

type OkObject = {
  "ok": boolean
}

async function checkApp(
  app: Pick<NestRmqService, "server"|"container"|"resolve"|"microservices"|"isListening"|"isInitialized"|"httpServer">,
  projection?: ProjectStrict<{
    "dbs": 0|1
    "consumers": 0|1
    "publishers": 0|1
  }>
) {
  const withPublishers = projectionIncludes(projection, "publishers")
  , withDb = projectionIncludes(projection, "dbs")
  , withConsumers = projectionIncludes(projection, "consumers")
  , consumersStatus: Dict<OkObject> = {}
  , dbsStatus: Dict<Dict<OkObject>> = {}
  , publishersStatus:Dict<OkObject> = {}

  let ok = true

  const {isListening} = app
  , port = (app.httpServer?.address() as null|AddressInfo)?.port

  if (
    port
    && app.httpServer
    && isListening !== undefined
  ) {
    consumersStatus[`:${port}`] = {"ok": isListening}
    ok = ok && isListening
  }

  for (const micro of [app, ...app.microservices ?? []]) {
    const {server} = micro

    if (!server)
      continue

    if (withConsumers) {
      const consumerStatus = consumersStatus[server.queue] = {
        "ok": server.server.isConnected()
      }
    
      ok = ok && consumerStatus.ok  
    }
  }

  const modules = Array.from(app.container.dynamicModulesMetadata.values())
  
  for (let m = modules.length; m-->0;) {
    //@ts-expect-error
    const {providers} = modules[m]
    if (!Array.isArray(providers))
      continue

    for (let p = providers.length; p-->0;) {
      const provider = providers[p]
      , id = /*typeof provider === "function" ? provider :*/ provider.provide

      if (!id)
        continue

      const s = await app.resolve(id).catch(_ => false)
      , type = typeof s

      if (!(type === "object" || type === "function"))
        continue
        
      switch (true) {
        case withDb && !!(s.db?.db && s.collection): {
          const {
            "db": {
              db,
              "db": {
                databaseName
              },
              readyState
            },
            "collection": {
              collectionName
            }
          } = s // as Model<any>
          , modelStatus = {"ok": (readyState === 1) && await invoke(async () => {
            try {
              const r = await (db as any).admin().ping({"maxTimeMS": 1000})

              return r.ok === 1
            } catch (_) {
              return false
            }
          })}

          ;(
            dbsStatus[databaseName] ??= {}
          )[collectionName] = modelStatus

          ok = ok && modelStatus.ok

          break
        }

        // TypeOrm
        case withDb && !!(s.metadata && s.metadata.tableName && s.metadata.connection): {
          const {
            "metadata": {          
              tableName,
              "connection": {
                "driver": {
                  database = "<undefined>"
                }
              }
            }
           } = s // as Repository<any>

          let repoStatus: OkObject
          try {
            repoStatus = {
              "ok": await invoke(async () => {
                const {ok} = await (s.manager.mongoQueryRunner.databaseConnection.db() as any).admin().ping({"maxTimeMS": 1000})

                return ok === 1
              })
            }
          } catch (e) {
            repoStatus = {
              "ok": false,
              //@ts-expect-error
              "message": e.message
            }
          }

          ;(
            dbsStatus[database] ??= {}
          )[tableName] = repoStatus

          ok = ok && repoStatus.ok

          break
        }

        // ClientRMQ
        case withPublishers && !!s.options?.queue: {
          const {
            client,
            disabled,
            "options": {
              queue
            }} = s as NestRmqClient
          , publisherStatus = publishersStatus[queue] = {
            "ok": disabled || client?.isConnected() === true,
            ...disabled && {disabled}
          }
          
          ok = ok && publisherStatus.ok

          break
        }

        default: continue
      }
    } 
  }

  return {
    ok,
    "consumers": withConsumers ? consumersStatus : undefined,
    "dbs": withDb ? dbsStatus : undefined,
    "publishers": withPublishers ? publishersStatus : undefined
  }
}
