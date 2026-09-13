import type { Config } from "jest";
import nextJest from "next/jest.js";

// Every test runs in one fixed timezone, UTC+8 (the Philippines), so anything that depends on
// local dates or times gives the same result on a laptop and on CI's UTC servers.
// Test workers inherit this environment variable.
process.env.TZ = "Asia/Manila";

// next/jest loads next.config.ts and .env files, compiles TS/TSX with SWC,
// and stubs out CSS, images and next/font so components can be imported in tests.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  // jsdom gives tests a fake browser (document, window) so React can render.
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Mirrors the "@/*" alias in tsconfig.json.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

// Exported this way because next/jest loads the Next.js config asynchronously.
export default createJestConfig(config);
