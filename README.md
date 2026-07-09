# Medical Appointment Agent

AI agent for scheduling, cancelling and listing medical appointments through natural language, built with **LangGraph**, **LangChain**, **OpenRouter**, **Fastify** and **PostgreSQL**.

## How it works

A LangGraph state graph classifies the user's intent and extracts structured data; scheduling and cancelling always propose the action first and only execute after the user explicitly confirms in a following message.

```
START → identifyIntent ─┬─ schedule ────────┐
                         ├─ cancel  ─────────┤
                         ├─ listAppointments ┤
                         └─ (unknown) ───────┴─→ message → END
```

Conversation history (LangGraph Postgres checkpointer) and appointment/professional data (Prisma) are both persisted, so context and bookings survive a restart.

## Stack

- Node.js 22.6+ (native TypeScript, `--experimental-strip-types`, no build step)
- Fastify 5
- LangGraph / LangChain (`ChatOpenAI.withStructuredOutput` for structured extraction)
- OpenRouter (LLM provider — `openai/gpt-4o-mini`)
- Prisma + PostgreSQL
- `@langchain/langgraph-checkpoint-postgres` (conversation history persistence)
- JWT + bcrypt (auth)
- Docker Compose

## Prerequisites

- Docker + Docker Compose (recommended path), **or** Node.js >= 22.6.0 and a reachable Postgres instance for a manual setup
- An [OpenRouter](https://openrouter.ai) API key

## Getting started

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd 03-medical-appointment-z
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | API key from openrouter.ai — powers both LLM calls (intent classification and reply generation) |
| `DATABASE_URL` | yes | Postgres connection string. When running via Docker Compose, this is overridden automatically to point at the `postgres` service — no need to edit it for that path |
| `JWT_SECRET` | yes | Secret used to sign auth tokens |
| `ENCRYPT_PEPPER` | yes | Extra secret mixed into password hashing |
| `APP_LANGUAGE` | yes, to seed data | `pt-BR` or `en` — controls the language of the 3 seeded professionals. If unset, the seed step is skipped and there will be no professionals to schedule with |
| `MAX_CHAT_MESSAGES` | no (default `20`) | Max messages (user + AI combined) allowed per conversation before it's locked |
| `CORS_ORIGIN` | no | Comma-separated list of allowed origins. If unset, all origins are accepted (safe here since auth uses Bearer tokens, not cookies) |
| `LANGSMITH_API_KEY` / `LANGCHAIN_TRACING_V2` / `LANGCHAIN_PROJECT` | no | Optional LangSmith tracing, useful for debugging the agent's reasoning |

### 2. Run with Docker Compose (recommended)

```bash
docker compose up -d --build
```

This starts Postgres and the app together. On startup the container automatically:
1. applies all Prisma migrations
2. seeds the 3 professionals (if `APP_LANGUAGE` is set)
3. starts the API on `http://localhost:3000`

### 3. Run manually (without Docker)

Requires a Postgres instance reachable at your `DATABASE_URL`.

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed        # requires APP_LANGUAGE to be set in .env
npm start
```

## Verifying it works

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  --data '{"name": "Maria Santos", "email": "maria@example.com", "password": "senha123"}'
# → { "token": "..." }
```

Use the token to call `POST /chat` (professional names must match one of the 3 seeded professionals). Scheduling/cancelling will ask for confirmation first — reply with the same `chatId` to confirm and actually execute it.

## Tests

```bash
npm test
```

End-to-end tests run against the real OpenRouter API (no mocks) and a real Postgres database — make sure `.env` is configured and the database is reachable before running them.

## API overview

All protected routes require `Authorization: Bearer <token>`.

| Method & path | Auth | Description |
|---|---|---|
| `POST /auth/signup` | – | Create an account, returns a token |
| `POST /auth/signin` | – | Log in, returns a token |
| `POST /auth/logout` | yes | Revoke the current token |
| `POST /chat` | yes | Send a message; omit `chatId` to start a new conversation, pass it to continue an existing one. Scheduling/cancelling proposes first (`success: false`) and only executes (`success: true`) after confirmation on a following message |
| `GET /chats` | yes | List the authenticated user's conversations |
| `GET /chats/:id` | yes | Full message history of a conversation |

Errors follow a consistent shape: `{ "error": "CODE", "message": "...", "details": {} }`. LLM failures (timeout, malformed output, quota, etc.) never surface as a `500` — they come back as a normal `200` response with `intent: "unknown"` and an apology message, ready to display as-is.

## Scope

Built to demonstrate the agent pattern of the LangGraph orchestration, structured extraction, confirmation-gated actions, persisted context, rather than to model a full-blown scheduling system. Auth is Bearer-token only (no refresh flow) and availability is a straightforward same-slot check, not per-professional working hours.

**Model choice:** the agent leans on reliable structured-output/function-calling, so which LLM you point `OPENROUTER_API_KEY` at matters. Recommended, all via OpenRouter:
- `openai/gpt-4o-mini` (current default)
- `anthropic/claude-3.5-haiku`
- `google/gemini-2.0-flash-001`

These are low-cost paid models, by design, testing against the free-tier models available today sthat showed real inconsistencies (unreliable structured output, weaker adherence to instructions like confirmation detection) that noticeably hurt the user experience, so the project intentionally moved off them.

## License

MIT
