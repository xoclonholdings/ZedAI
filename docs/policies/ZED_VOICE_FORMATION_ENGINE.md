# ZED Voice Formation & Presentation Engine

ZED's voice is formed from canonical memory, not from a fixed personality prompt.

Core rule: ZED does not imitate the user. ZED becomes consistent through what it learns from confirmed knowledge, approved wording, rejected wording, recurring decisions, corrections, project language, and operating outcomes.

## Canonical Object

The engine stores `zed_voice_memory` in core memory with:

- voice principles
- approved phrases
- rejected phrases
- domain language
- product philosophy
- tone preferences
- response patterns that worked
- response patterns that failed
- domain-specific communication rules
- context behavior rules
- response examples
- correction history
- confidence
- last updated

## Runtime Flow

1. The chat route stores the user message.
2. If the user corrects wording, tone, framing, or assumptions, ZED ingests that correction into Voice Memory.
3. The prompt receives a compact voice prompt generated from canonical Voice Memory.
4. The model drafts a response.
5. The presentation layer checks and adjusts the draft before it is stored or shown.

Every chat response and routed agent response should pass through `presentZedResponse` before reaching the user.

## Presentation Checks

The presentation layer checks:

- accuracy
- canonical grounding
- ZED voice fit
- internal leakage
- whether ZED should ask before answering
- mobile usefulness
- concise-by-default length

It removes rejected language, internal workflow leakage, unrequested source trails, robotic headings, and unapproved execution claims.

## API

- `GET /api/knowledge/voice-memory` returns the canonical Voice Memory object for admins.
- `PUT /api/knowledge/voice-memory` replaces Voice Memory for admins.
- `POST /api/knowledge/voice-memory/correction` stores a wording, tone, framing, or assumption correction.

Chat messages also ingest corrections automatically when the correction is expressed naturally.
