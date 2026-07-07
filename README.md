# Medical Appointment Agent

AI agent for scheduling and cancelling medical appointments through natural language, built with **LangGraph**, **LangChain**, **OpenRouter**, **Fastify** and **PostgreSQL**.

Users authenticate, then chat naturally (`POST /chat`) to book or cancel appointments. The agent identifies intent, extracts structured data, executes the action, and replies conversationally — with each conversation's full history persisted in Postgres.

## How it works

The agent runs as a state graph: it identifies the user's intent from a chat message, extracts the relevant details (professional, date/time, patient name), performs the requested action, and replies in natural language.

```
START → identifyIntent ─┬─ schedule ─┐
                         ├─ cancel  ──┼─→ message → END
                         └─ (unknown)─┘
```

- **identifyIntent**: classifies the request (`schedule` / `cancel` / `unknown`) and extracts structured data via LLM, validated with Zod.
- **schedule / cancel**: validate required fields and perform the action against the appointment service.
- **message**: generates a friendly, natural-language reply based on the outcome.

Each conversation is persisted via a LangGraph Postgres checkpointer, so both the intent-classification and reply-generation steps have access to the full conversation history — enabling natural follow-ups (e.g. "was my appointment actually confirmed?").

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
npx prisma migrate deploy
npx prisma db seed        # requires APP_LANGUAGE to be set in .env
npm start
```

## Verifying it works

```bash
# 1. Create an account (signup logs you in automatically)
curl -X POST http://localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  --data '{"name": "Maria Santos", "email": "maria@example.com", "password": "senha123"}'
# → { "token": "..." }

# 2. Chat with the agent (use the token from step 1)
curl -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  --data '{"question": "Quero agendar uma consulta com Dr. Alicio da Silva amanhã às 16h, meu nome é Maria Santos"}'
# → { "chatId": "...", "reply": "...", "intent": "schedule", "success": true }
```

Reuse the returned `chatId` in the body of your next request to continue the same conversation with full memory.

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
| `POST /chat` | yes | Send a message; omit `chatId` to start a new conversation, pass it to continue an existing one |
| `GET /chats` | yes | List the authenticated user's conversations |
| `GET /chats/:id` | yes | Full message history of a conversation |

Errors follow a consistent shape: `{ "error": "CODE", "message": "...", "details": {} }`. LLM failures (timeout, malformed output, quota, etc.) never surface as a `500` — they come back as a normal `200` response with `intent: "unknown"` and an apology message, ready to display as-is.

## Known limitations

This is a portfolio project, so some scope is deliberately limited:

- No refresh tokens — once the 7-day token expires, the user has to log in again.
- Appointment conflict checking is simple: same professional + exact same timestamp = unavailable. There's no modeling of per-professional working hours/availability windows.
- No "list my appointments" intent yet — the agent only handles scheduling and cancelling via chat.

## License

MIT
