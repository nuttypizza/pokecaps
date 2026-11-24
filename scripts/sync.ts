/**
 * Sync sets and cards from the Pokémon TCG API into Postgres.
 *
 *   npm run sync                 # new and changed sets only
 *   npm run sync -- --full       # re-fetch every set
 *   npm run sync -- --scope-only # only fetch cards for Scarlet & Violet onward
 *   npm run sync -- --source=github
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(`--${name}`);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const source = (value("source") ?? process.env.SYNC_SOURCE ?? "github") as "api" | "github" | "auto";

  const { db, sql } = await import("../src/db/client");
  const { runSync } = await import("../src/sync/run");
  try {
    const r = await runSync(db, { source, full: flag("full"), scopeOnly: flag("scope-only") });
    console.log(
      `Done (run ${r.runId}, ${r.source}${r.setsFromFallback ? ` + github for ${r.setsFromFallback} set(s)` : ""}): ${r.setsFetched}/${r.setsSeen} sets fetched, ${r.cardsNew} new, ${r.cardsChanged} changed, ${r.cardsUnchanged} unchanged.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
