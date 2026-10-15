import { describe, expect, it } from "vitest";
import { cleanMessage, groupByDay, MAX_MESSAGE_LENGTH, relativeDay } from "./chat";

describe("chat entre tiendas y admin", () => {
  it("no envía mensajes vacíos ni demasiado largos", () => {
    expect(cleanMessage("   ")).toEqual({ error: "Escribe un mensaje." });
    expect(cleanMessage("  ¿Mañana hay reparto?  \r\n")).toEqual({ body: "¿Mañana hay reparto?" });
    expect(cleanMessage("Hola\r\nQué tal")).toEqual({ body: "Hola\nQué tal" });
    expect("error" in cleanMessage("x".repeat(MAX_MESSAGE_LENGTH + 1))).toBe(true);
    expect(cleanMessage("x".repeat(MAX_MESSAGE_LENGTH))).toEqual({ body: "x".repeat(MAX_MESSAGE_LENGTH) });
  });

  it("dice «Hoy» y «Ayer»", () => {
    expect(relativeDay("2026-10-15", "2026-10-15")).toBe("Hoy");
    expect(relativeDay("2026-10-14", "2026-10-15")).toBe("Ayer");
    expect(relativeDay("2026-10-13", "2026-10-15")).toBeNull();
    expect(relativeDay("2026-09-30", "2026-10-01")).toBe("Ayer");
  });

  it("separa los mensajes por día en hora de Alzira", () => {
    const groups = groupByDay([
      { id: 1, created_at: "2026-10-14T21:30:00Z" }, // 23:30 del 14 en Alzira
      { id: 2, created_at: "2026-10-14T22:30:00Z" }, // 00:30 del 15
      { id: 3, created_at: "2026-10-15T08:00:00Z" },
    ]);
    expect(groups.map((g) => [g.date, g.messages.map((m) => m.id)])).toEqual([
      ["2026-10-14", [1]],
      ["2026-10-15", [2, 3]],
    ]);
    expect(groupByDay([])).toEqual([]);
  });
});
