import "server-only";

import nodemailer from "nodemailer";

import { getEnv } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

// Bandeja en memoria para los tests: guarda los emails en lugar de enviarlos.
const memoryOutbox: EmailMessage[] = [];

export function getMemoryOutbox(): readonly EmailMessage[] {
  return memoryOutbox;
}

export function clearMemoryOutbox(): void {
  memoryOutbox.length = 0;
}

let smtp: nodemailer.Transporter | null = null;

function smtpTransport(): EmailTransport {
  const env = getEnv();
  if (!smtp) {
    smtp = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Mailpit en desarrollo no usa TLS; producción usará otro transporte.
      secure: false,
      ignoreTLS: env.NODE_ENV !== "production",
    });
  }
  return {
    async send(message) {
      await smtp!.sendMail({ from: env.EMAIL_FROM, ...message });
    },
  };
}

export function getEmailTransport(): EmailTransport {
  const env = getEnv();
  switch (env.EMAIL_TRANSPORT) {
    case "smtp":
      return smtpTransport();
    case "memory":
      return { send: async (message) => void memoryOutbox.push(message) };
    case "console":
      return {
        async send(message) {
          // Solo en desarrollo. Se muestra el texto plano para poder copiar el enlace.
          console.info(`\n[email] Para: ${message.to}\n[email] Asunto: ${message.subject}\n${message.text}\n`);
        },
      };
  }
}

// Un fallo de envío nunca debe cambiar la respuesta al usuario (no revela si
// el email existe) ni filtrar el enlace o el token a los logs.
export async function sendEmailSafely(label: string, message: EmailMessage): Promise<void> {
  try {
    await getEmailTransport().send(message);
  } catch (error) {
    console.error(`[email] Falló el envío de ${label}:`, error instanceof Error ? error.name : "desconocido");
  }
}
