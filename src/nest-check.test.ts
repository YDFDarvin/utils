import { sleep } from "./async"
import { checkApp } from "./nest-check"
import { start } from "./nest-check-testing"
import type {
  Return
} from "./ts-utils.types"

let app: Return<typeof start>

beforeAll(async () => app = await start())
afterAll(() => sleep(10).then(() => app.close()))

describe(checkApp.name, () => {
  it("demo", async () => expect(
    await checkApp(app, {})
  ).toStrictEqual({
    "ok": true,
    "consumers": {
      "test-health": {
        "ok": true
      }
    },
    "dbs": {
      "test": {
        "test-health": {
          "ok": true
        }
      }
    },
    "publishers": {
      "test-health": {
        "ok": true
      }
    }
  }))
})
