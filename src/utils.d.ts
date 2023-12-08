export type OrMinMax<V extends string | number> = V | {
  "minimum": V
  "maximum": V
}

export type orSetOfDefined<V> = Defined<V>|Set<Defined<V>>