import type {OneOf2} from "../ts-utils.types";

export type {
  ArangoBaseDocument
}

type ArangoBaseDocument = OneOf2<{ _id?: string | number | unknown }, { id?: string | number | unknown }> & {
  collection?: string;
  _key?: string;
  _rev?: string;
};