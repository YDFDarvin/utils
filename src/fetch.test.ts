import express = require("express")
import type { Server } from "http"
import { port } from "./config"
import { fetch } from "./fetch"

const base = `http://localhost:${port}`

let close: () => Promise<void>

beforeAll(async () => {
  const app = express()
  .use(express.json())
  .post("/echo", ({body}, res) => res.send(body))
  .get("/echo", ({query}, res) => res.send(query))
  .get("/timeout/:duration", (req, res) => {
    const {"params": {duration}} = req
    , timerId = setTimeout(() => {
      res.send(duration)
    }, +duration)

    req.on("close", () => clearTimeout(timerId))
  })

  , server = await new Promise<Server>((res, rej) => {
    try {
      const server = app.listen(port, () => res(server))
    } catch (e) {
      rej(e)
    }
  })

  console.log("server started")
  
  close = () => new Promise<void>((res, rej) => server.close(err => err ? rej(err) : res()))
})
afterAll(async () => {
  console.log("closing")
  await close().catch(console.error)
  console.log("closed")
})

describe(fetch.name, () => {
  it("echo data", async () => expect(await fetch({
    "url": `${base}/echo`,
    "method": "POST",
    "data": {"a": 1},
  })).toMatchObject({
    "ok": true,
    "status": 200,
    "data": {"a": 1},
  }))

  it("echo query", async () => expect(await fetch({
    "url": `${base}/echo`,
    "method": "GET",
    "query": {
      "v": false,
      "undefined": undefined,
      "number": 1,
      "arr": [1, 2]
    },
  })).toMatchObject({
    "ok": true,
    "status": 200,
    "data": {
      "v": "false",
      "number": "1",
      "arr": ["1", "2"]
    },
  }))

  it("timeout ok", async () => expect(await fetch({
    "url": `${base}/timeout/10`,
    "method": "GET",
    "timeout": 100
  })).toMatchObject({
    "data": 10
  }))

  it("timeout fallen", async () => expect(await fetch({
    "url": `${base}/timeout/1000`,
    "method": "GET",
    "timeout": 100
  })).toMatchObject({
    "status": -1,
    "statusText": "The user aborted a request."
  }))

  it("not json in response", async () => expect(await fetch({
    "url": `${base}/timeout/abc`,
    "method": "GET"
  })).toMatchObject({
    "text": "abc"
  }))
})