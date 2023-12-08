import { sleep } from "./async"

main()

async function main() {
  await sleep(1000)

  console.log("forked")
}
