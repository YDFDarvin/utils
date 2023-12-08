import { sleep } from "../../async"

dep1()

async function dep1() {
  await sleep(1000)

  console.log("dep1")
}
