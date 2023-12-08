import { Database } from 'arangojs';
import type { Config } from 'arangojs/connection';
import type { Require } from "../ts-utils.types";

export async function initArangoDatabase(
  dbParams: Require<Config, 'databaseName' | 'url'>,
): Promise<Database> {
  const { databaseName } = dbParams;

  let db = new Database({ ...dbParams, databaseName: undefined });
  const databases = await db.databases();
  const targetDatabase = databases.find((db) => db.name === databaseName);

  if (!targetDatabase) await db.createDatabase(databaseName);

  db = db.database(databaseName);
  return db;
}
