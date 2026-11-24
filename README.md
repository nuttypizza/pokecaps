# PokeCaps

Browse, sort and filter Pokémon TCG cards by the gameplay capabilities they provide (draw, search, energy acceleration, healing, switching, disruption and more).

Card data comes from [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data), the open data set behind the Pokémon TCG API. The app covers the **Scarlet & Violet block and every series released after it** (Mega Evolution onward); older sets are synced too and can be shown with a checkbox.

## Status

| Phase | What | State |
| --- | --- | --- |
| 1. Foundation | Database, card sync, daily sync job, browse and filter | Done |
| 2. Rule tagging | Effect extraction, capability taxonomy, rule-based tagger, capability filters | **This release** |
| 3. LLM and review | Claude classifier, confidence scores, review queue, manual edits | Next |
| 4. Polish | Taxonomy editor, errata handling, logins for a public site | Planned |

## How it works

```
pokemon-tcg-data ──► scripts/sync.ts ──► scripts/analyze.ts ──► Postgres ──► Next.js app
  (GitHub, free)        daily via GitHub Actions (sync, then analyze)
```

- **`sets`**: every set, with an `in_scope` flag (see `src/sync/scope.ts`).
- **`raw_cards`**: each card's JSON as received, plus a hash of its gameplay fields. A changed hash marks the card `needs_analysis` for phase 2. Legality, rarity and price changes don't.
- **`cards`**: flattened columns used for filtering and sorting.
- **`sync_runs`**: one row per sync with counts of new, changed and unchanged cards.

- **`taxonomy_tags`**: the capability list. It's defined in `src/analysis/taxonomy.ts` and copied to the database on each analysis run.
- **`effects`**: one row per ability, attack and rules text on each in-scope card, with a hash of its normalized wording (lowercase, the card's own name replaced by `{self}`). Reprints share a hash, so they share tags. Reminder text such as the Pokémon ex rule is skipped.
- **`machine_tags`**: capability tags per effect hash, with source (`rule` now, `llm` in phase 3), analyzer version, confidence and params such as cards drawn or damage healed.

Later phases add their own tables. Sync and analysis never write to the table that holds your manual edits.

### Sync

```bash
npm run sync                  # new sets, changed sets, and sets released in the last 60 days
npm run sync -- --full        # re-fetch every set
npm run sync -- --scope-only  # only fetch cards for in-scope sets
npm run sync -- --source=github
```

The default source is the GitHub data repo: free, no key needed. The [Pokémon TCG API](https://pokemontcg.io) is deprecated (closed to new sign-ups; existing keys stop working on March 1, 2027) and its successor, Scrydex, is paid. The API client is kept behind `SYNC_SOURCE=api` or `auto`. If the data repo stops receiving new sets, a second free source such as TCGdex can be added in `src/sync/sources.ts`.

### Capability tagging

```bash
npm run analyze               # cards that are new or changed since the last run
npm run analyze -- --all      # every in-scope card
```

The rule tagger (`src/analysis/rules.ts`) is a list of patterns over effect text. It tags about 90% of distinct in-scope effect texts; most of the rest are one-off effects that phase 3's Claude classifier will handle. To change a rule, edit it, add a test case with the real card text to `src/analysis/rules.test.ts`, and bump `RULES_VERSION`; the next analysis run re-tags every card.

## Local development

Requires Node 22 and Postgres.

```bash
cp .env.example .env.local    # set DATABASE_URL
npm install
npm run db:migrate
npm run sync                  # a few minutes on first run
npm run dev                   # http://localhost:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Deploying on free tiers

1. **Database**: create a free Postgres on [Neon](https://neon.tech) (scales to zero when idle). Copy its connection string.
2. **GitHub secret** (Settings → Secrets and variables → Actions): add `DATABASE_URL`. Run the **Sync card data** workflow once by hand to load everything. After that it runs daily at 09:00 UTC, with a full refresh on Sundays.
3. **App**: import the repo on [Vercel](https://vercel.com) and set `DATABASE_URL`. Pages are cached for an hour, card images load straight from the card image CDN, and visitors never trigger data or LLM calls, so traffic adds no usage cost.

Vercel's free plan is for non-commercial use. Check that before running ads or charging for the public site.
