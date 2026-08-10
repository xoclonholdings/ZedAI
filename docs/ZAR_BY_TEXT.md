# ZAR by Text

ZAR by Text is an SMS access channel into the existing authenticated ZAR identity. It does not create a second user, memory store, or chatbot. A verified phone connection resolves to a ZCOS user, then inbound messages enter `ChatExecutionService` with channel permissions and ZAR Galaxy scope.

## Runtime path

`Telnyx webhook -> signature and replay validation -> idempotent inbound envelope -> verified phone hash -> owned ZAR conversation -> ChatExecutionService -> SMS formatter -> durable outbound queue -> Telnyx`

The old generic `/api/intake/sms` placeholder is removed. Provider-specific behavior is isolated in `server/services/sms/TelnyxSmsProvider.ts` behind the `SmsProvider` contract.

## Required production environment

- `DATABASE_URL`: authoritative PostgreSQL database.
- `SMS_ENCRYPTION_KEY`: at least 32 random characters; used to encrypt phone numbers/message envelopes and derive non-reversible lookup hashes.
- `TELNYX_API_KEY`: Telnyx Messaging API key.
- `TELNYX_PUBLIC_KEY`: Telnyx webhook Ed25519 public key, PEM or base64 DER.
- `TELNYX_PHONE_NUMBER`: ZAR's E.164 Telnyx number.
- `FRONTEND_URL`: `https://zar-ai.online`, the HTTPS ZAR origin used for secure connection and continuation links.
- `SMS_WEBHOOK_MAX_AGE_SECONDS`: optional; defaults to 300.
- `TELNYX_API_BASE_URL`: optional; defaults to `https://api.telnyx.com/v2`.

Configure the Telnyx messaging webhook as `POST https://api.zar-ai.online/api/sms/webhooks/telnyx` and enable message-received plus delivery-status events.

## Local verification

1. Install root, shared, server, and client dependencies.
2. Set the required environment variables against a development PostgreSQL database.
3. Start the server; startup migrations create the `sms_*` tables.
4. Sign in, open NEXYS, choose **Text**, enter a phone number, and verify the six-digit code.
5. Send `STATUS`, `HELP`, and a natural-language question to the Telnyx number.
6. Confirm the question appears in the single `ZAR by Text` conversation and the reply is delivered by Telnyx.
7. Send `STOP`, confirm ordinary messages no longer route, then send `START`.
8. Disconnect from the Text panel and confirm `STATUS` reveals no account information.

## Security boundaries

Phone numbers are normalized to E.164, encrypted at rest, and resolved by keyed hashes. Verification codes are hashed, expire after ten minutes, and allow five attempts. Webhooks require current Telnyx Ed25519 signatures. Provider IDs and outbound idempotency keys prevent duplicate processing. Logs and security activity use last-four digits or keyed hashes, not full phone numbers, verification codes, secrets, or unrestricted message bodies. Sensitive or destructive requests continue inside authenticated ZAR instead of executing through SMS.
