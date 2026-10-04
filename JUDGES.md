# Reviewing Clockwrit in five minutes

Nothing to install, no account needed.

1. **Open https://clockwrit.vercel.app.** The clock is Winnipeg’s legal time. Under it, the page reads *your browser’s* own tz data for 2 November 2026 and tells you whether it agrees with the law. Scroll to **Four clocks, one instant**: the law, IANA 2026e, this server (Vercel’s Node, tzdata 2026c) and your browser, side by side, with the statute each answer rests on.
2. **Ask** (https://clockwrit.vercel.app/ask). Click a suggested question, e.g. *“When exactly does Manitoba’s permanent time start — and why does tzdata say a different date?”* Watch the evidence trail: the GROQ queries against the typed dataset, the Knowledge Base reads, and the deterministic `legal_time` call. Then switch **Answer under** to *Ukraine bill 4201* and ask about Kyiv in July 2027: the same tools read the dataset through that Content Release.
3. **Ruling desk** (https://clockwrit.vercel.app/desk). These conflicts were raised by the Sanity Context Knowledge Base itself. On an open one, click **Ask the agent to draft a ruling**, read its rationale and its check against the typed records, then approve it with the reviewer passcode from the submission post. The issue is resolved in the Knowledge Base and becomes a standing instruction; the ruling is written back to the dataset. A ruled example (Indonesia, Eid al-Fitr 1447) is already there.
4. **Eval** (https://clockwrit.vercel.app/eval). 30 held-out questions, three arms, every answer and the judge’s reason. Filter to *traps* or *agent wrong*.
5. **Audit** (https://clockwrit.vercel.app/audit?demo=1) runs a sample weekly meeting across New York, Winnipeg, Warsaw and Kyiv and flags each occurrence.
6. **Check the data yourself.** The dataset is public: [instruments with authority and status](https://c9x90tjo.api.sanity.io/v2026-09-01/data/query/production?query=*%5B_type%3D%3D%22instrument%22%5D%7Btitle%2Cauthority%2Cstatus%2Curl%7D), [Manitoba’s clock regimes](https://c9x90tjo.api.sanity.io/v2026-09-01/data/query/production?query=*%5B_type%3D%3D%22ruleSegment%22%26%26zone-%3EianaId%3D%3D%22America%2FWinnipeg%22%5D%7BvalidFrom%2CvalidTo%2CstdOffsetMinutes%2C%22basis%22%3Abasis%5B%5D-%3Etitle%7D).
7. **Plug it into your own agent:** `claude mcp add --transport http clockwrit https://clockwrit.vercel.app/api/mcp`, or any MCP client pointed at that URL.

Sanity project ID: `c9x90tjo` (dataset `production`, public). What is and isn’t claimed: [docs/CLAIMS.md](docs/CLAIMS.md).
