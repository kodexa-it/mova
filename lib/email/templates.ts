import type { EmailMessage } from "@/lib/email/transport";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, body: string, action: { label: string; url: string }): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f6f4;font-family:Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e6e6e1;border-radius:12px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b66">Mova</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(action.label)}</a></p>
<p style="margin:0;font-size:12px;color:#6b6b66">Si el botón no funciona, copiá este enlace: ${escapeHtml(action.url)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

const paragraph = (text: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(text)}</p>`;

export function verificationEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const greeting = `Hola ${input.name},`;
  const line = "Confirmá tu email para empezar a usar Mova. El enlace vence en 24 horas.";
  return {
    to: input.to,
    subject: "Confirmá tu email en Mova",
    html: layout("Confirmá tu email", paragraph(greeting) + paragraph(line), { label: "Confirmar email", url: input.url }),
    text: `${greeting}\n\n${line}\n\n${input.url}\n`,
  };
}

export function passwordResetEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const greeting = `Hola ${input.name},`;
  const line = "Recibimos un pedido para cambiar tu contraseña. El enlace vence en 1 hora. Si no fuiste vos, ignorá este email.";
  return {
    to: input.to,
    subject: "Cambiá tu contraseña de Mova",
    html: layout("Cambiá tu contraseña", paragraph(greeting) + paragraph(line), { label: "Cambiar contraseña", url: input.url }),
    text: `${greeting}\n\n${line}\n\n${input.url}\n`,
  };
}

const ROLE_LABELS = { OWNER: "Dueño", EDITOR: "Editor", APPROVER: "Aprobador", VIEWER: "Lector" } as const;

export function invitationEmail(input: {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: keyof typeof ROLE_LABELS;
  url: string;
}): EmailMessage {
  const line = `${input.inviterName} te invitó a sumarte a "${input.workspaceName}" en Mova con el rol ${ROLE_LABELS[input.role]}. La invitación vence en 7 días.`;
  return {
    to: input.to,
    subject: `Te invitaron a ${input.workspaceName} en Mova`,
    html: layout("Tenés una invitación", paragraph(line), { label: "Ver invitación", url: input.url }),
    text: `${line}\n\n${input.url}\n`,
  };
}

// Aviso de trabajo pendiente en un workspace (por ejemplo, piezas para revisar).
export function reviewReadyEmail(input: { to: string; name: string; workspaceName: string; title: string; body: string; url: string }): EmailMessage {
  const greeting = `Hola ${input.name},`;
  const where = `En "${input.workspaceName}":`;
  return {
    to: input.to,
    subject: `${input.title} · ${input.workspaceName}`,
    html: layout(input.title, paragraph(greeting) + paragraph(where) + paragraph(input.body), { label: "Abrir en Mova", url: input.url }),
    text: `${greeting}\n\n${where}\n${input.body}\n\n${input.url}\n`,
  };
}
