import type { Config } from "jest";
import nextJest from "next/jest.js";

// Every test runs in one fixed timezone, UTC+8 (the Philippines), so anything that depends on
// local dates or times gives the same result on a laptop and on CI's UTC servers.
// Test workers inherit this environment variable.
//
// `npm run test:dst` sets SIPAT_TEST_TZ to run the daylight-saving tests (*.dst.test.ts) in
// New York instead. Those files are skipped in the normal run, where they'd be meaningless.
const testTimezone = process.env.SIPAT_TEST_TZ;
process.env.TZ = testTimezone ?? "Asia/Manila";

// next/jest loads next.config.ts and .env files, compiles TS/TSX with SWC,
// and stubs out CSS, images and next/font so components can be imported in tests.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  // jsdom gives tests a fake browser (document, window) so React can render.
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Jest's default is 5 s per test. Under heavy load (many test files at once, a slow CI machine)
  // a long component test once went past that and failed for no real reason. A flaky red run
  // teaches people to ignore red, so allow more time. A genuinely stuck test still fails.
  testTimeout: 20_000,
  // Mirrors the "@/*" alias in tsconfig.json.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", ...(testTimezone ? [] : ["\\.dst\\.test\\."])],
};

// Exported this way because next/jest loads the Next.js config asynchronously.
export default createJestConfig(config);
