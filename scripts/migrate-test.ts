#!/usr/bin/env node
import { runTestMigration } from '../apps/api/src/lib/migrateTest.js';

runTestMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31m[Test Migration Failed]\x1b[0m ${message}`);
    process.exit(1);
  });
