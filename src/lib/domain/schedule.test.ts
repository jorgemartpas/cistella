import { describe, expect, it } from "vitest";
import { cutoffFor, nextOpenDateForWeekday, upcomingDeliveryDates, type ScheduleRule } from "./schedule";

// Calendario por defecto: martes y viernes, cierre a las 20:00 del día anterior
const rules: ScheduleRule[] = [
  { weekday: 2, active: true, cutoffDaysBefore: 1, cutoffTime: "20:00" },
  { weekday: 5, active: true, cutoffDaysBefore: 1, cutoffTime: "20:00" },
];

describe("calendario de reparto", () => {
  it("calcula el cierre la víspera a las 20:00 de Madrid", () => {
    expect(cutoffFor("2026-10-16", rules[1]).toISOString()).toBe("2026-10-15T18:00:00.000Z");
    expect(cutoffFor("2026-10-27", rules[0]).toISOString()).toBe("2026-10-26T19:00:00.000Z");
  });

  it("lista los repartos que aún no han cerrado", () => {
    const now = new Date("2026-10-15T10:00:00Z"); // jueves por la mañana
    const dates = upcomingDeliveryDates(rules, "2026-10-15", 16, now).map((d) => d.date);
    expect(dates).toEqual(["2026-10-16", "2026-10-20", "2026-10-23", "2026-10-27", "2026-10-30"]);
  });

  it("descarta el reparto del día siguiente pasada la hora de cierre", () => {
    const now = new Date("2026-10-15T18:30:00Z"); // jueves 20:30 en Alzira
    const dates = upcomingDeliveryDates(rules, "2026-10-15", 7, now).map((d) => d.date);
    expect(dates).toEqual(["2026-10-20"]);
  });

  it("ignora los días desactivados", () => {
    const onlyTuesday = rules.map((r) => (r.weekday === 5 ? { ...r, active: false } : r));
    const now = new Date("2026-10-15T10:00:00Z");
    const dates = upcomingDeliveryDates(onlyTuesday, "2026-10-15", 14, now).map((d) => d.date);
    expect(dates).toEqual(["2026-10-20", "2026-10-27"]);
  });

  it("encuentra el siguiente reparto abierto de un día de la semana", () => {
    const thursdayNight = new Date("2026-10-15T19:00:00Z");
    expect(nextOpenDateForWeekday(rules, 5, thursdayNight)?.date).toBe("2026-10-23");
    expect(nextOpenDateForWeekday(rules, 2, thursdayNight)?.date).toBe("2026-10-20");
    expect(nextOpenDateForWeekday(rules, 3, thursdayNight)).toBeNull();
  });
});
