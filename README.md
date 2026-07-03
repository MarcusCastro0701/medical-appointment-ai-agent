# Medical Appointment Agent

AI agent for scheduling and cancelling medical appointments through natural language, built with **LangGraph**, **LangChain**, **OpenRouter** and **Fastify**.

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

## Stack

- Node.js 22+ (native TypeScript, no build step)
- LangGraph / LangChain
- OpenRouter (LLM provider)
- Fastify
- Zod (structured validation)

## Getting started

```bash
npm install
cp .env.example .env   # fill in OPENROUTER_API_KEY
npm start
```

Server runs on `http://localhost:3000`, exposing `POST /chat`:

```bash
curl -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  --data '{"question": "Quero agendar uma consulta com Dr. Alicio da Silva amanhã às 16h, meu nome é Maria Santos"}'
```

## Tests

```bash
npm test
```

End-to-end tests run against the real OpenRouter API (no mocks).

## Status

Work in progress — appointment data is currently stored in memory (resets on restart), and conversations are not persisted across requests. See open items in the project board/issues.

## License

MIT
