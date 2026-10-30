import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/real',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90000,
  use: { baseURL: 'http://localhost:8082', channel: 'msedge', trace: 'off' },
  webServer: {
    command: 'npm.cmd exec --workspace @fintrack/mobile -- expo start --web --port 8082',
    url: 'http://localhost:8082',
    reuseExistingServer: false,
    timeout: 120000,
    env: { EXPO_PUBLIC_API_URL: 'http://localhost:3101/v1', CI: '1' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
