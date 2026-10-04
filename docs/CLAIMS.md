# Claims ledger

Every public claim, tagged by how you can check it.

- **REPRODUCIBLE** — run a command in this repository and get the same result.
- **VERIFIED-LIVE** — observable on the deployment or the public dataset right now.
- **SOURCED** — rests on a cited primary or secondary source in the dataset; follow the link.
- **NOT CLAIMED** — said out loud so nobody assumes it.

## Engine and data

| Claim | Tier | How to check |
|---|---|---|
| Every clock regime in the dataset reproduces IANA tzdata 2026e offsets, sampled daily and hourly around every transition, 2020–2028 (one documented divergence: Beirut, 25–29 March 2023). | REPRODUCIBLE | `pnpm --filter @wallclock/knowledge check` |
| The engine passes 30 tests covering zic rules, southern-hemisphere DST, gaps and overlaps, segment changes, calendars, overrides, suspensions and audits. | REPRODUCIBLE | `pnpm --filter @wallclock/core test` |
| The IANA reference (moment-timezone 0.6.5, tzdata 2026e) agrees with Python’s zoneinfo + tzdata 2026.5 on the zones checked. | REPRODUCIBLE | compare `ianaOffset()` with `zoneinfo` |
| Node 24.13 ships tzdata 2025b and disagrees with 2026e on 11 of 597 zones in 2026–27. | REPRODUCIBLE | `pnpm --filter @wallclock/core drift 2026 2027` on Node 24.13 |
| Vercel’s Node runtime (this deployment) ships tzdata 2026c and disagrees on 4 zones. | VERIFIED-LIVE | `GET /api/drift` |
| Manitoba’s permanent UTC−05 is legally in force from 31 October 2026; tzdata 2026e models it at 1 November 02:00. | SOURCED | the proclamation and IANA NEWS, linked from the Manitoba regime |
| Ukraine’s bill 4201 has not been signed; Kyiv still observes summer time. | SOURCED | the Verkhovna Rada bill card, linked from the instrument |
| 845 documents, 179 instruments (83 primary), 47 zones, 58 jurisdictions, 7 pending-law releases. | VERIFIED-LIVE | public dataset queries in [JUDGES.md](../JUDGES.md) |

## Knowledge Base and ruling loop

| Claim | Tier | How to check |
|---|---|---|
| The Knowledge Base was built from 90 original sources, imported in two phases with their authority tier. | REPRODUCIBLE | `knowledge/sources/*.md`, `knowledge/kb.ts` |
| The conflicts on the ruling desk were raised by the Knowledge Base build, not written by us. | VERIFIED-LIVE | `/desk`; each conflict shows its Knowledge Base issue id |
| Approving a ruling resolves the issue through the Knowledge Base API and creates a standing instruction. | VERIFIED-LIVE | the Indonesia Eid ruling on `/desk` |
| The agent cannot apply a ruling: approval is a code path behind a passcode or a Sanity identity with org-admin and write access. | REPRODUCIBLE | `web/src/app/api/rulings/decide/route.ts`, `web/src/lib/reviewer.ts` |

## Evaluation

| Claim | Tier | How to check |
|---|---|---|
| On 30 held-out questions the agent scored 30/30, the same model without tools 22/30, keyword search over the same sources 16/30. | REPRODUCIBLE | `eval/results/latest-test.json`; rerun with `pnpm --filter @wallclock/eval eval` |
| The questions and answer key were written from verified sources before the agent was built; 10 were used during development and are not in the score. | SOURCED | `eval/questions.jsonl` (`split` field) |
| The judge is a different model family from the one answering. | REPRODUCIBLE | `eval/src/judge.ts` |

## Not claimed

- That Clockwrit knows every time zone or every public holiday. It covers 47 zones and 58 jurisdictions where something changed or is contested; outside them it says so.
- That the evaluation measures discovery of unknown facts. The dataset and the questions come from the same research; the evaluation measures whether structure gets the agent to the right answer.
- That the Knowledge Base’s own authority tags are reliable. Clockwrit takes authority from the typed records.
- That anything here is legal advice.
