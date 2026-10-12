import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.{test,spec}.ts"],
    testTimeout: 10000,
    env: {
      DB_NAME: "fuelpoint_test",
      NODE_ENV: "test",
    },
  },
});
