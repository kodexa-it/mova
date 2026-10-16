import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "prisma/generated/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prisma y los secretos no pueden llegar a componentes de cliente.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/client"], importNames: ["PrismaClient"], message: "Usá lib/prisma (server-only)." },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
