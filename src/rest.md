
## Mapping

| http end    | name      | body/query                        | response                     | /:id/sub        | name                | TBD  |
| ----------- | --------- | --------------------------------- | ---------------------------- | --------------- | ------------------- | ---- |
| POST /      | create    | EntDTO & EntW                     | id & EntDTO & EntR & *sid[]* |                 |                     |      |
| PUT /       |           |                                   |                              | PUT /           | rebind              |      |
| PATCH /     |           |                                   |                              | PATCH /         | add                 |      |
| GET /       | find      | Query<EntDto & EntR>              | id & EntDTO & EntR *& sid[]* | GET /           | *values* *bindings* |      |
| DELETE /    |           |                                   |                              | DELETE /        | clear               |      |
| *POST /:id* | *upsert*? |                                   |                              |                 |                     |      |
| PUT /:id    | replace   | EntDTO & EntW & *sid[]*           | id & EntDTO & EntR & *sid[]* | PUT /:sid       | set                 |      |
| PATCH /:id  | *update*  | Partial\(EntDTO & EntW & *sid[]*) | id & EntDTO & EntR & *sid[]* |                 |                     |      |
| GET /:id    | get       |                                   | id & EntDTO & EntR & *sid[]* | GET /:sid       | *pick* *retrieve*   |      |
| DELETE /:id | delete    |                                   | stats                        | DELETE /:sid    | remove              |      |
|             |           |                                   |                              |                 |                     |      |
|             |           |                                   |                              | *GET /sub/:sid* | *retrieve*          |      |

