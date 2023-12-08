import type { ModuleMetadata, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";

export {
  createTestModule
};

async function createTestModule(m: Type<unknown>, additionalImports: ModuleMetadata["imports"] = []) {
  const mod = await Test.createTestingModule({
    "imports": [
      m,
      ...Reflect.getMetadata("imports", m),
      ...additionalImports
    ]
  }).compile()

  return mod
}