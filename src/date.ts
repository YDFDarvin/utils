export {
  reviveDate
}

function reviveDate<T>(source: T) {
  return typeof source === "string" || typeof source === "number"
  ? new Date(source)
  : source as Exclude<T, string|number>
}

