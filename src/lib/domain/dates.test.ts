import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isISODate, isoWeekday, madridDate, madridLocalToUTC } from "./dates";

describe("fechas de calendario", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("cuenta días entre fechas", () => {
    expect(daysBetween("2026-10-13", "2026-10-27")).toBe(14);
    expect(daysBetween("2026-10-27", "2026-10-13")).toBe(-14);
    // El cambio de hora no afecta a las fechas
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("calcula el día de la semana ISO", () => {
    expect(isoWeekday("2026-10-12")).toBe(1); // lunes
    expect(isoWeekday("2026-10-13")).toBe(2); // martes
    expect(isoWeekday("2026-10-16")).toBe(5); // viernes
    expect(isoWeekday("2026-10-18")).toBe(7); // domingo
  });

  it("valida fechas", () => {
    expect(isISODate("2026-10-15")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("15/10/2026")).toBe(false);
  });
});

describe("hora de Madrid", () => {
  it("convierte hora local a UTC en verano (UTC+2)", () => {
    expect(madridLocalToUTC("2026-10-12", "20:00").toISOString()).toBe("2026-10-12T18:00:00.000Z");
  });

  it("convierte hora local a UTC en invierno (UTC+1)", () => {
    expect(madridLocalToUTC("2026-11-02", "20:00").toISOString()).toBe("2026-11-02T19:00:00.000Z");
  });

  it("respeta el día del cambio de hora", () => {
    // 25 oct 2026: a las 3:00 vuelven a ser las 2:00
    expect(madridLocalToUTC("2026-10-25", "20:00").toISOString()).toBe("2026-10-25T19:00:00.000Z");
    // 29 mar 2026: a las 2:00 pasan a ser las 3:00
    expect(madridLocalToUTC("2026-03-29", "12:00").toISOString()).toBe("2026-03-29T10:00:00.000Z");
  });

  it("da la fecha local de un instante", () => {
    expect(madridDate(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-16");
    expect(madridDate(new Date("2026-10-15T21:59:00Z"))).toBe("2026-10-15");
  });
});
