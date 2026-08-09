# ZILLION Capital Boundary

Finance and Trading runtime ownership has moved from ZAR to `xoclonholdings/Zillion-prosper`.

ZAR retains only:

- Finance intent classification and conversational coordination
- An authenticated `/api/capital/launch` deep link
- Owner-bound, short-lived capability invocation of ZILLION `/api/capital/agent`
- Signed ZCOS capability endpoints for the shared model, web search, owner-scoped knowledge, approvals, and audit authority

ZAR no longer contains Budget or Trading pages, domain routes, state stores, broker bridges, trading schedulers, or Capital-specific shared contracts. Existing `/budget`, `/trading`, and Finance workspace links are compatibility redirects to ZILLION.

The cross-galaxy envelope binds timestamp, message ID, verified owner ID, HTTP method, request path, and exact body. Message IDs are replay-protected in PostgreSQL in production. ZILLION knowledge is tagged by origin galaxy and owner before it can be retrieved.

Reusable Finance/Trading flow definitions remain with the flow system pending their canonical ZYLO Automate migration; their Finance stages delegate to ZILLION and do not execute Capital logic inside ZAR.

Live trading remains uncertified and fail-closed in ZILLION. No repository migration authorizes real-money execution.
