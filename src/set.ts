export { }

const {from: $from} = Array

function toArray<T>(this: Set<T>) {
  //TODO Consider .sort()
  return $from(this)
}

//@ts-expect-error
Set.prototype.toJSON = toArray
//@ts-expect-error
Set.prototype.toBSON = toArray
