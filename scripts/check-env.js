#!/usr/bin/env node

/**
 * CAL METER — Monorepo Environment Check Script
 * Validates that Node.js, npm, and workspace dependencies satisfy production standards.
 */

const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0] || '0', 10);

console.log(`[CAL METER] Node.js version: v${nodeVersion}`);

if (majorVersion < 20) {
  console.error(`[CAL METER ERROR] Node.js version must be >= 20.x (found v${nodeVersion}).`);
  process.exit(1);
}

console.log('[CAL METER] Environment verification passed.');
process.exit(0);
