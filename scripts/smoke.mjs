// Prueba de humo contra la app corriendo (`npm run build && npm start`, con
// EMAIL_TRANSPORT=console). Recorre el flujo real por HTTP: registro,
// verificación, login, workspace, páginas y protecciones básicas.
//
//   node scripts/smoke.mjs http://localhost:3000 ruta/al/log-del-servidor
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const serverLog = process.argv[3];
const email = `humo-${Date.now()}@ejemplo.com`;
const password = "contraseña-de-humo-123";
let cookie = "";
let failures = 0;

function check(label, condition) {
  console.info(`${condition ? "OK  " : "FALLA"} ${label}`);
  if (!condition) failures += 1;
}

async function request(path, init = {}) {
  const headers = { origin: base, ...(init.body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...init.headers };
  const response = await fetch(base + path, { redirect: "manual", ...init, headers });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => c.split(/=(.*)/s).slice(0, 2)));
    for (const c of setCookie) {
      const [pair] = c.split(";");
      const [name, value] = pair.split(/=(.*)/s);
      if (value === "" || /max-age=0/i.test(c)) jar.delete(name);
      else jar.set(name, value);
    }
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  return response;
}

// Sin sesión
check("/w sin sesión redirige al login", [307, 308].includes((await request("/w")).status));
const headersRes = await request("/ingresar");
check("la página de login carga", headersRes.status === 200);
check("envía Content-Security-Policy", Boolean(headersRes.headers.get("content-security-policy")));
check("envía X-Frame-Options DENY", headersRes.headers.get("x-frame-options") === "DENY");
check("no expone X-Powered-By", !headersRes.headers.get("x-powered-by"));

// Registro y verificación
const signUp = await request("/api/auth/sign-up/email", {
  method: "POST",
  body: JSON.stringify({ name: "Prueba de humo", email, password, callbackURL: "/w" }),
});
check("registro responde 200", signUp.status === 200);
const notVerified = await request("/api/workspaces", { method: "POST", body: JSON.stringify({ name: "Antes de verificar" }) });
check("sin email verificado no crea workspace (403)", notVerified.status === 403);

await new Promise((r) => setTimeout(r, 500));
const log = serverLog ? readFileSync(serverLog, "utf8") : "";
const link = [...log.matchAll(/http\S*verify-email\S*/g)].map((m) => m[0]).find((l) => log.indexOf(email) < log.indexOf(l));
check("el email de verificación salió (transporte console)", Boolean(link));
if (link) {
  const verify = await request(new URL(link).pathname + new URL(link).search);
  check("el enlace de verificación redirige", [302, 307].includes(verify.status));
}

// Login y workspace
const signIn = await request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
check("login responde 200", signIn.status === 200);
const created = await request("/api/workspaces", { method: "POST", body: JSON.stringify({ name: "Kodexa humo" }) });
check("crea el workspace (201)", created.status === 201);
const slug = (await created.json().catch(() => ({})))?.workspace?.slug;

const foreign = await request("/api/workspaces", {
  method: "POST",
  body: JSON.stringify({ name: "Desde otro sitio" }),
  headers: { origin: "https://sitio-malicioso.com" },
});
check("rechaza mutaciones desde otra origin (403)", foreign.status === 403);

for (const path of ["/w", `/w/${slug}`, `/w/${slug}/integrantes`, `/w/${slug}/configuracion`, `/w/${slug}/auditoria`]) {
  check(`${path} carga (200)`, (await request(path)).status === 200);
}
check("un workspace ajeno responde 404", (await request("/w/no-existe-este-workspace")).status === 404);

const invite = await request(`/api/w/${slug}/invitations`, {
  method: "POST",
  body: JSON.stringify({ email: "invitada-humo@ejemplo.com", role: "EDITOR" }),
});
check("envía una invitación (201)", invite.status === 201);

await request("/api/auth/sign-out", { method: "POST", body: "{}" });
check("después de cerrar sesión la API responde 401", (await request("/api/workspaces")).status === 401);

console.info(failures === 0 ? "\nPrueba de humo: todo OK" : `\nPrueba de humo: ${failures} fallas`);
process.exit(failures === 0 ? 0 : 1);
