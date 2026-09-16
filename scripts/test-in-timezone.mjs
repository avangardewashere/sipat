// Runs Jest with a different timezone, in a fresh process so the change really applies.
//
//   node scripts/test-in-timezone.mjs <IANA timezone> [jest arguments…]
//   node scripts/test-in-timezone.mjs America/New_York src/lib/stats/week.dst.test.ts
//
// Works the same on Windows, macOS and Linux (unlike `TZ=… jest` in an npm script).
import { spawnSync } from "node:child_process";

const [timezone, ...jestArgs] = process.argv.slice(2);
if (!timezone) {
  console.error("Usage: node scripts/test-in-timezone.mjs <IANA timezone> [jest arguments…]");
  process.exit(2);
}

const result = spawnSync("npx", ["jest", ...jestArgs], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SIPAT_TEST_TZ: timezone },
});
process.exit(result.status ?? 1);
