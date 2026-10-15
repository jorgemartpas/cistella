// Genera supabase/instalacion-completa.sql: todas las migraciones + el seed en un solo archivo,
// para instalar la base de datos pegándolo una vez en el SQL Editor de Supabase.
// Uso: npm run sql:instalacion  (vuelve a ejecutarlo si cambias alguna migración)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrations = fs
  .readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => `supabase/migrations/${f}`);
const parts = [...migrations, "supabase/seed.sql"].map(
  (file) => `-- ════════ ${file} ════════\n\n${fs.readFileSync(path.join(root, file), "utf8").trim()}\n`,
);
const header = `-- Cistella: instalación completa de la base de datos (proyecto de Supabase nuevo).
-- Archivo generado con \`npm run sql:instalacion\`; no lo edites a mano.
-- Pégalo entero en Supabase → SQL Editor y pulsa Run. Solo se ejecuta una vez.
`;
fs.writeFileSync(path.join(root, "supabase/instalacion-completa.sql"), `${header}\n${parts.join("\n")}`);
console.log(`supabase/instalacion-completa.sql (${parts.length} partes)`);
