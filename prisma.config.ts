import "dotenv/config";
import { defineConfig } from "prisma/config";

// La URL la da el entorno: DATABASE_URL en desarrollo y producción. Los tests
// de integración la reemplazan por TEST_DATABASE_URL antes de migrar.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
