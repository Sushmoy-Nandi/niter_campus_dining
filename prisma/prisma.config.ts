import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url: "postgresql://postgres:postgres@localhost:5432/campus_dining_niter",
  },
})
