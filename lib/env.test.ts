import { afterEach, describe, expect, it } from "vitest";

import { allowedOrigins, getEnv, resetEnvCache } from "@/lib/env";

const BASE = {
  DATABASE_URL: "postgresql://mova:x@localhost:5433/mova",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

function withEnv(values: Record<string, string | undefined>) {
  const original = { ...process.env };
  Object.assign(process.env, BASE, values);
  resetEnvCache();
  return () => {
    process.env = original;
    resetEnvCache();
  };
}

let restore: () => void = () => {};
afterEach(() => restore());

describe("variables de entorno", () => {
  it("acepta una configuración local válida", () => {
    restore = withEnv({ EMAIL_TRANSPORT: "console" });
    expect(getEnv().EMAIL_TRANSPORT).toBe("console");
  });

  it("exige un secreto de al menos 32 caracteres sin mostrar su valor", () => {
    restore = withEnv({ BETTER_AUTH_SECRET: "corto-y-secreto" });
    expect(() => getEnv()).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => getEnv()).not.toThrow(/corto-y-secreto/);
  });

  it("smtp requiere host y puerto", () => {
    restore = withEnv({ EMAIL_TRANSPORT: "smtp", SMTP_HOST: undefined, SMTP_PORT: undefined });
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    expect(() => getEnv()).toThrow(/SMTP_HOST/);
  });

  it("en producción fuera de localhost exige un email real", () => {
    restore = withEnv({ NODE_ENV: "production", APP_URL: "https://mova.ejemplo.com", EMAIL_TRANSPORT: "console" });
    expect(() => getEnv()).toThrow(/producción/);
  });

  it("permite probar el build de producción en localhost", () => {
    restore = withEnv({ NODE_ENV: "production", EMAIL_TRANSPORT: "console" });
    expect(getEnv().NODE_ENV).toBe("production");
  });
});

describe("origins permitidas", () => {
  it("en desarrollo acepta localhost y 127.0.0.1 en el mismo puerto", () => {
    expect(allowedOrigins({ APP_URL: "http://localhost:3000", NODE_ENV: "development" })).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("en producción acepta solo la origin de APP_URL", () => {
    expect(allowedOrigins({ APP_URL: "http://localhost:3000", NODE_ENV: "production" })).toEqual(["http://localhost:3000"]);
    expect(allowedOrigins({ APP_URL: "https://app.mova.example", NODE_ENV: "development" })).toEqual(["https://app.mova.example"]);
  });
});
