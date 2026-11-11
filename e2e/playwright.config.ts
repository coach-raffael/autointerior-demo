import { defineConfig, devices } from "@playwright/test";

// BASE_URL setzt deploy-demo.yml (mit / am Ende): https://demos.coach-raffael.com/car-interior/
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  retries: 1,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:5173/", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
