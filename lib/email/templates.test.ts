import { describe, expect, it } from "vitest";

import { escapeHtml, invitationEmail } from "@/lib/email/templates";

describe("plantillas de email", () => {
  it("escapa HTML", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("no inyecta HTML desde el nombre del workspace", () => {
    const email = invitationEmail({
      to: "a@b.com",
      workspaceName: "<img src=x onerror=alert(1)>",
      inviterName: "Ana",
      role: "EDITOR",
      url: "http://localhost:3000/invitacion/abc",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.text).toContain("Editor");
  });
});
