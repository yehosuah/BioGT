import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: "cd apps/web && npx next start --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/map`,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_MAP_FIXTURE_MODE: "true",
      NEXT_PUBLIC_MAP_STYLE_URL: "/map-test-fixtures/style.json"
    }
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
