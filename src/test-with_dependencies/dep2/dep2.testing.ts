import { sleep } from "../../async"

dep2()

async function dep2() {
  await sleep(1000)
  console.log("dep2")
}
