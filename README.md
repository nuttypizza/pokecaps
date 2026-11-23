# PokeCaps

Browse, sort and filter Pokémon TCG cards by the gameplay capabilities they provide (draw, search, energy acceleration, healing, switching, disruption and more).

Card data comes from the [Pokémon TCG API](https://pokemontcg.io). The app covers the **Scarlet & Violet block and every series released after it** (Mega Evolution onward); older sets are synced too and can be shown with a checkbox.

## Status

| Phase | What | State |
| --- | --- | --- |
| 1. Foundation | Database, card sync, daily sync job, browse and filter | **This release** |
| 2. Rule tagging | Effect extraction, capability taxonomy, rule-based tagger | Next |
| 3. LLM and review | Claude classifier, confidence scores, review queue, manual edits | Planned |
| 4. Polish | Taxonomy editor, errata handling, logins for a public site | Planned |

## How it works

```
Pokémon TCG API ──► scripts/sync.ts ──► Postgres ──► Next.js app
 (fallback: GitHub data repo)   daily via GitHub Actions
```

- **`sets`**: every set, with an `in_scope` flag (see `src/sync/scope.ts`).
- **`raw_cards`**: each card's JSON as received, plus a hash of its gameplay fields. A changed hash marks the card `needs_analysis` for phase 2. Legality, rarity and price changes don't.
- **`cards`**: flattened columns used for filtering and sorting.
- **`sync_runs`**: one row per sync with counts of new, changed and unchanged cards.

Later phases add their own tables. Sync and analysis never write to the table that holds your manual edits.

### Sync

```bash
npm run sync                  # new sets, changed sets, and sets released in the last 60 days
npm run sync -- --full        # re-fetch every set
npm run sync -- --scope-only  # only fetch cards for in-scope sets
npm run sync -- --source=github
```

`SYNC_SOURCE=auto` (the default) uses the API and falls back to the
[maintainers' data repo](https://github.com/PokemonTCG/pokemon-tcg-data) for any set the API fails to serve. The API returns frequent 5xx errors without a key, so set `POKEMONTCG_API_KEY`.

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
2. **API key**: get a free key at [dev.pokemontcg.io](https://dev.pokemontcg.io) (20,000 requests a day).
3. **GitHub secrets** (Settings → Secrets and variables → Actions): add `DATABASE_URL` and `POKEMONTCG_API_KEY`. Run the **Sync card data** workflow once by hand to load everything. After that it runs daily at 09:00 UTC, with a full refresh on Sundays.
4. **App**: import the repo on [Vercel](https://vercel.com) and set `DATABASE_URL`. Pages are cached for an hour, card images load straight from the card image CDN, and visitors never trigger API or LLM calls, so traffic adds no usage cost.

Vercel's free plan is for non-commercial use. Check that before running ads or charging for the public site.
