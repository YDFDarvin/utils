/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  createCipheriv,
  createDecipheriv
} from "crypto";
import envSchema from "./encryption.schema.json";
import { doEnv } from "./env";
import type {
  Arg0,
  Arg1,
  Arg2,
  Partest
} from "./ts-utils.types";

export {
  encrypt,
  decrypt,
  maskPattern
};
export type {
  EncOpts
};

type EncOpts = {
  "algorithm": Arg0<typeof createCipheriv>
  "key": Arg1<typeof createCipheriv>
  "iv": Arg2<typeof createCipheriv>
}

const {
  "ENCRYPT_ALGO": algorithm,
  ENCRYPT_PATTERN,
  "ENCRYPT_KEY": key,
  "ENCRYPT_IV": iv,
} = doEnv(envSchema)
, maskRegex = ENCRYPT_PATTERN && new RegExp(ENCRYPT_PATTERN, "g")
, defaultOpts: Partest<EncOpts> = {
  algorithm,
  key,
  iv
}

function maskPattern(string: string, opts = defaultOpts) {
  return !(
    opts.key
    && opts.iv
    && opts.algorithm
    && maskRegex
  )
  ? string 
  // TODO async
  : string.replace(maskRegex, chunk => encrypt(chunk, opts as EncOpts))
}

function encrypt(text: string, {algorithm, key, iv}: EncOpts) {
  const cipher = createCipheriv(algorithm, key, iv);

  return `${
    cipher.update(text, "utf8", "base64")
  }${
    cipher.final("base64")
  }`;
}

function decrypt(text: string, {algorithm, key, iv}: EncOpts) {
  const decipher = createDecipheriv(algorithm, key, iv);
  
  return `${
    decipher.update(text, "base64", "utf8")
   }${
    decipher.final("utf8")
  }`;
}
