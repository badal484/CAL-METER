#!/usr/bin/env node
import { runTestMigration } from '../apps/api/src/lib/migrateTest.js';
import { sanitizeMigrationDiagnostic } from '../apps/api/src/lib/testDbGuard.js';

runTestMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const sanitized = sanitizeMigrationDiagnostic(rawMessage);
    console.error(`\x1b[31m[Test Migration Failed]\x1b[0m ${sanitized}`);
    process.exit(1);
  });
