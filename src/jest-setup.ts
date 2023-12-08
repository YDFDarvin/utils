import { expect } from "@jest/globals";
import type { Options } from 'ajv';
import Ajv from 'ajv';
import { fullFormats } from "ajv-formats/dist/formats";
import ajvKeywords from "ajv-keywords";
import { matchersWithOptions } from 'jest-json-schema';
import type { Arg0 } from "./ts-utils.types";

let jestAjv: Ajv

const ajvOpts: Options = {
  "verbose": true,
  "allErrors": true,
  "strict": true,
  "strictRequired": false,
  "allowUnionTypes": true,
  "formats": {
    ...fullFormats
  },
}

//@ts-ignore
expect.extend(matchersWithOptions(
  {
    ...ajvOpts,
    "AjvClass": Ajv,
  } as Arg0<typeof matchersWithOptions>,
  //@ts-ignore
  a => jestAjv = ajvKeywords(a as unknown as Ajv)
))

export {
  jestAjv
};

