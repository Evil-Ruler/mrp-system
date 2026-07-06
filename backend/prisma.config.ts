import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"), // This feeds your local .env database URL safely to Prisma Migrate
  },
});
