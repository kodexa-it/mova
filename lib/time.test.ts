import { describe, expect, it } from "vitest";

import { addDays, addMonths, dayLabel, isYmd, monthWeeks, weekdayOf, weekLabel, weekStartOf, zonedHm, zonedRange, zonedToUtc, zonedYmd } from "@/lib/time";

describe("días del calendario", () => {
  it("valida fechas reales", () => {
    expect(isYmd("2026-10-15")).toBe(true);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-13-01")).toBe(false);
    expect(isYmd("15/10/2026")).toBe(false);
  });

  it("las semanas empiezan el lunes", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
    expect(weekdayOf("2026-10-25")).toBe(7);
    expect(weekStartOf("2026-10-15")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });

  it("suma días y meses sin desbordar", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("la vista mensual cubre el mes completo con semanas enteras", () => {
    const weeks = monthWeeks("2026-10-20");
    expect(weeks[0]).toBe("2026-09-28");
    expect(weeks.at(-1)).toBe("2026-10-26");
    expect(weeks).toHaveLength(5);
    expect(monthWeeks("2026-02-01")).toHaveLength(5);
  });

  it("nombra semanas y días en español", () => {
    expect(weekLabel("2026-10-12")).toBe("12 al 18 de octubre");
    expect(weekLabel("2026-10-26")).toBe("26 de octubre al 1 de noviembre");
    expect(weekLabel("2026-12-28")).toBe("28 de diciembre de 2026 al 3 de enero de 2027");
    expect(dayLabel("2026-10-15")).toBe("jueves 15 de octubre");
  });
});

describe("zona horaria", () => {
  const AR = "America/Argentina/Buenos_Aires";
  it("convierte la hora local de Buenos Aires a UTC", () => {
    expect(zonedToUtc("2026-10-15", "10:00", AR).toISOString()).toBe("2026-10-15T13:00:00.000Z");
    expect(zonedToUtc("2026-10-15", "23:30", AR).toISOString()).toBe("2026-10-16T02:30:00.000Z");
  });

  it("ida y vuelta conserva el día y la hora", () => {
    for (const tz of [AR, "Europe/Madrid", "America/Santiago", "America/Mexico_City"]) {
      const date = zonedToUtc("2026-03-29", "21:45", tz);
      expect(zonedYmd(date, tz)).toBe("2026-03-29");
      expect(zonedHm(date, tz)).toBe("21:45");
    }
  });

  it("respeta el cambio de horario de Madrid", () => {
    // Antes y después del 29/3/2026 (UTC+1 → UTC+2).
    expect(zonedToUtc("2026-03-28", "12:00", "Europe/Madrid").toISOString()).toBe("2026-03-28T11:00:00.000Z");
    expect(zonedToUtc("2026-03-30", "12:00", "Europe/Madrid").toISOString()).toBe("2026-03-30T10:00:00.000Z");
    // 02:30 no existe ese día: se corre hacia adelante.
    expect(zonedHm(zonedToUtc("2026-03-29", "02:30", "Europe/Madrid"), "Europe/Madrid")).toBe("03:30");
  });

  it("el rango de una semana local incluye la medianoche de inicio y excluye la del final", () => {
    const range = zonedRange("2026-10-12", "2026-10-19", AR);
    expect(range.gte.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });
});
