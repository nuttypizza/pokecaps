/**
 * Tag card effects with capabilities.
 *
 *   npm run analyze          # cards that are new or changed since the last run
 *   npm run analyze -- --all # every in-scope card
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const all = process.argv.includes("--all");
  const { db, pool } = await import("../src/db/client");
  const { runAnalysis } = await import("../src/analysis/run");
  try {
    const r = await runAnalysis(db, { all, log: (m) => console.log(m) });
    console.log(
      `Done (${r.rulesVersion}${r.fullRetag ? ", full" : ""}): ${r.cards} cards, ${r.effects} effects, ${r.hashesTagged} distinct texts tagged, ${r.tagsWritten} tags written.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
