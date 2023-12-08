
## Usage

Controller:
```typescript
// @RmqController
class Controller {
  @Inject(Service) service!: Service

  async method(payload) {
    return await service.method(
      assignLogger(payload)
    )
  }
}
```

Service: 
```typescript
@Injectable()
class Service {
  @Inject(SomeApi) someApi!: SomeApi

  async method(payload) {
    const {trace} = payload

    trace!.log({
      "method": "method",
    }, payload.items.length)

    const items = await this.someApi.get({
      "ids": payload.items.map(({id}) => id)
      trace
    })

    return prettify({trace, items})
  }
}
```

Unit:
```typescript
function prettify({trace, items}: WithLogger<{items: {...}[]}>) {
  trace!.log({
    "fn": prettify.name
  })

}
```
