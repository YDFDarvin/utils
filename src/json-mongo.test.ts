import { ObjectId } from "mongodb";
import { dump2data } from "./json-mongo";

it(dump2data.name, () => {
  const date = new Date()
  , objId = new ObjectId()

  date.setMilliseconds(0)

  expect(dump2data([{
    "null": null,
    "obj": {},
    "date": {"$date": `${date}`},
    "objId": {"$oid": `${objId}`}
  }])).toStrictEqual([{
    "null": null,
    "obj": {},
    date,
    objId
  }])
})