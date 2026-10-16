import { describe, expect, it } from "vitest";

import { emptyContent, type FormatContent } from "@/modules/content/formats";
import { validateContent } from "@/modules/content/validators";
import { brandChecks, placeholdersIn } from "@/modules/content/validators/brand";
import { captionChecks } from "@/modules/content/validators/caption";
import { scoreHook } from "@/modules/content/validators/hook";
import { humanChecks, stockPhrasesIn } from "@/modules/content/validators/human";
import { reelChecks, timeline } from "@/modules/content/validators/reel";
import { concreteMarkers, wre } from "@/modules/content/validators/report";

const status = (checks: { id: string; status: string }[], id: string) => checks.find((c) => c.id === id)?.status;

describe("límites de palabra con tildes", () => {
  it("reconoce palabras que terminan en vocal acentuada", () => {
    expect(wre(String.raw`\bguardá\b`).test("Guardá este post")).toBe(true);
    expect(wre(String.raw`\bguardá\b`).test("guardás")).toBe(false);
  });

  it("encuentra cifras y nombres propios, no la mayúscula que abre la oración", () => {
    expect(concreteMarkers("Atendimos 120 pymes en Córdoba.")).toEqual(["120", "Córdoba"]);
    expect(concreteMarkers("Hoy hablamos de impuestos.")).toEqual([]);
  });
});

describe("caption", () => {
  it("pasa un caption con gancho concreto, un pedido y pocos hashtags", () => {
    const checks = captionChecks("Ahorramos 14 horas por mes a un estudio de Rosario.\n\nTe contamos cómo. Guardá este post para cuando lo necesites.", ["automatizacion"]);
    expect(checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("falla con más de 5 hashtags y si empieza con un hashtag", () => {
    const checks = captionChecks("#pymes Un texto", ["a", "b", "c", "d", "e", "f"]);
    expect(status(checks, "caption.hashtags")).toBe("fail");
    expect(status(checks, "caption.first-line")).toBe("fail");
  });

  it("advierte cuando hay dos pedidos distintos", () => {
    const checks = captionChecks("Datos útiles para tu estudio.\nGuardá este post y escribinos un mensaje.");
    expect(status(checks, "caption.ask")).toBe("warn");
  });

  it("falla con un caption vacío o de más de 2200 caracteres", () => {
    expect(status(captionChecks(""), "caption.length")).toBe("fail");
    expect(status(captionChecks("a".repeat(2201)), "caption.length")).toBe("fail");
  });
});

describe("hook", () => {
  it("un hook concreto, corto y dirigido a quien mira es fuerte", () => {
    const result = scoreHook("Perdés 3 horas por semana copiando facturas a mano");
    expect(result.verdict).toBe("fuerte");
  });

  it("un saludo con preámbulo es flojo y queda marcado", () => {
    const result = scoreHook("Hola a todos, en este video les voy a contar algunas cosas interesantes sobre nuestro trabajo");
    expect(result.verdict).toBe("flojo");
    expect(result.dealbreakers.length).toBeGreaterThanOrEqual(2);
  });
});

describe("guion de Reel", () => {
  it("estima los tiempos a ~150 palabras por minuto", () => {
    const [first] = timeline(["uno dos tres cuatro cinco"]);
    expect(first!.duration).toBeCloseTo(2, 1);
  });

  it("advierte si el hook tarda más de 3 segundos y si la duración no coincide", () => {
    const checks = reelChecks(["Esta es una primera línea bastante larga que nadie va a terminar de escuchar a tiempo", "Fin."], 60);
    expect(status(checks, "reel.hook-time")).toBe("warn");
    expect(status(checks, "reel.duration")).toBe("warn");
  });
});

describe("texto genérico", () => {
  it("detecta frases hechas en español", () => {
    expect(stockPhrasesIn("En el mundo actual, llevar al siguiente nivel tu negocio es clave.")).toEqual(["en el mundo actual", "llevar al siguiente nivel"]);
    expect(status(humanChecks("En la era digital todo cambia."), "human.stock")).toBe("warn");
  });

  it("detecta caracteres invisibles", () => {
    expect(status(humanChecks("Hola​mundo"), "human.invisible")).toBe("fail");
  });
});

describe("reglas de marca", () => {
  it("no deja aprobar con datos por completar", () => {
    expect(placeholdersIn("Ayudamos a {{cantidad de clientes}} empresas")).toEqual(["cantidad de clientes"]);
    expect(status(brandChecks("Ayudamos a {{cantidad}} empresas", { wordsToAvoid: [] }), "brand.placeholders")).toBe("fail");
  });

  it("marca las palabras que la marca evita, aunque tengan tilde", () => {
    expect(status(brandChecks("Un servicio barato y rápido", { wordsToAvoid: ["barato"] }), "brand.avoid")).toBe("fail");
    expect(status(brandChecks("Un servicio baratísimo", { wordsToAvoid: ["barato"] }), "brand.avoid")).toBeUndefined();
  });
});

describe("reporte por pieza", () => {
  it("un carrusel con un dato sin completar queda en 'fix'", () => {
    const content: FormatContent<"CAROUSEL"> = {
      caption: "Tres errores que vemos en {{rubro}}.\nGuardá este post.",
      altText: "Slides con texto",
      hashtags: ["pymes"],
      slides: [
        { title: "3 errores que te cuestan clientes", body: "" },
        { title: "Responder tarde", body: "Cada hora cuenta." },
        { title: "Cierre", body: "Escribinos." },
      ],
    };
    const report = validateContent("CAROUSEL", content, { wordsToAvoid: [] });
    expect(report.verdict).toBe("fix");
  });

  it("el contenido vacío de cada formato produce un reporte sin romperse", () => {
    for (const format of ["FEED_IMAGE", "CAROUSEL", "REEL", "STORY"] as const) {
      const report = validateContent(format, emptyContent(format), { wordsToAvoid: [] });
      expect(report.verdict).toBe("fix");
    }
  });
});
