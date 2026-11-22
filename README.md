# AuraGuide AI

A GenAI assistant that helps families and communities get through severe winter smog and urban air pollution. It turns live air quality data into a personal daily plan and shows, in numbers, what each choice changes.

Built for PromptWars Virtual, Challenge 6: Urban Air Quality Assistant (Hack2skill and Google for Developers).

- Live app: https://aura-guide-ai.vercel.app/
- Demo video: https://www.loom.com/share/f186e4353f2c4f0097723f7946a573ec
- Build post: https://www.linkedin.com/feed/update/urn:li:activity:7529590080232042496/

## The problem

On a bad smog day people know the air is unhealthy, but they do not know what to do differently at 7 am, or whether a change is worth the effort. Generic tips ("avoid going out") do not fit a family with a school run, an elderly parent and a fixed commute.

## What AuraGuide AI does

1. Takes a city and a short household profile: members, ages, health sensitivities, commute mode, cooking fuel, purifier.
2. Fetches the current air quality and the hourly forecast for that location.
3. Calculates each member's pollution exposure for their normal day.
4. Uses Gemini to build an optimised day: safer time windows, commute swaps, indoor air fixes and low-emission alternatives.
5. Shows the normal day and the optimised day side by side, with exposure avoided and emissions saved for every suggestion.

## Features

| Feature | What it does |
| --- | --- |
| Smog Day Planner | Personal hour-by-hour plan for the household, based on live and forecast AQI |
| Impact engine | Deterministic exposure and emissions calculations, so the numbers are computed and not guessed by the model |
| Before and after view | Normal day against optimised day, with totals |
| Safe-window timeline | Marks the cleanest hours in the next 24 hours for the school run, exercise and ventilation |
| Sensitive profiles | Tighter thresholds for asthma, pregnancy, infants, elderly people and outdoor workers |
| Indoor air module | Guidance on cooking fuel, incense and coils, ventilation timing and purifier use |
| What-if chat | Ask "what if I cycle instead of taking an auto?" and the engine recalculates before Gemini explains |
| Community mode | Generates a shareable daily advisory for a housing society or school |
| Languages | English, Hindi and Bengali, with wording adapted for elders and children |
| Demo households | One tap loads a sample family so the full flow can be seen in seconds |
| Model fallback chain | A busy Gemini model is retried, then the next model in the chain is used. If no model answers, the app says so clearly instead of guessing |

## How GenAI is used

Gemini does the reasoning and the language. The code does the arithmetic.

| Task | Handled by |
| --- | --- |
| AQI category, exposure dose, emissions saved | Code (`src/domain`) |
| Choosing and ordering actions for this household | Gemini |
| Explaining each number in plain words | Gemini |
| Answering what-if questions using recalculated figures | Gemini plus code |
| Translating and adapting tone | Gemini |
| Writing the community advisory | Gemini |

Gemini returns structured JSON. The response is validated against a schema before anything is shown, and every number in it is replaced with the engine's value. If Gemini cannot answer, the API returns a clear "AI unavailable" error and writes nothing.

## Architecture

```
Browser (Next.js UI)
   |
   |  POST /api/plan, /api/whatif, /api/advisory
   v
Next.js API routes (server)
   |-- rate limit per client
   |-- validate input (Zod)
   |-- Open-Meteo Geocoding      -> coordinates
   |-- Open-Meteo Air Quality    -> current + hourly forecast (cached)
   |-- Impact engine             -> exposure, emissions, AQI category
   |-- Gemini API                -> plan, explanations (cached)
   v
Validated JSON response
```

There is no database and no login. The household profile stays in the browser session.

## Tech stack

- Next.js (App Router) and TypeScript in strict mode
- Gemini API through Google AI Studio, called only from the server
- Open-Meteo Air Quality API and Geocoding API (no key needed)
- Zod for input and output validation
- Vitest for unit tests, Playwright with axe for end-to-end and accessibility tests
- ESLint and Prettier
- GitHub Actions for lint, type check and tests
- Deployed on Vercel

## Getting started

Requirements: Node.js 20 or later.

```bash
git clone https://github.com/animeshrick/AuraGuide-AI.git
cd AuraGuide-AI
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Deploying to Vercel

1. Import the GitHub repository in Vercel. It detects Next.js, so the default build settings work.
2. In Project Settings, Environment Variables, add `GEMINI_API_KEY` (and any optional variables above).
3. Deploy. The API routes run as Node.js functions, and the key stays on the server.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side key from Google AI Studio |
| `GEMINI_MODEL` | No | First model to call (default `gemini-3.6-flash`) |
| `GEMINI_MODEL_2` | No | Second model, used when the first is busy (default `gemini-2.5-flash`) |
| `GEMINI_MODEL_3` | No | Third model (default `gemini-3.5-flash-lite`) |
| `GEMINI_RETRY_BASE_MS` | No | Wait before the first retry, doubled for each retry (default 1000) |
| `RATE_LIMIT_PER_MINUTE` | No | Requests allowed per client per minute (default 30) |

Only `.env.example` is committed. Real keys are never in the repository.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run format:check` | Prettier check |
| `npm test` | Unit tests with coverage |
| `npm run test:e2e` | Playwright and axe tests |

## Project structure

```
src/
  app/            page, layout and the three API routes
  components/     UI components; household/, whatif/, advisory/ and outing/ hold the parts of larger panels
  hooks/          page state and request handling (usePlanSession, useLatestRequest)
  domain/         impact engine: AQI, exposure, emissions, safe windows, what-if, outings, plants, shared input limits
  ai/             prompts, Gemini client, model fallback chain, response schemas
  lib/            air quality client, API route helper, cache, rate limiter, validation
  i18n/           English, Hindi, Bengali strings
tests/
  unit/           engine, validation and schema tests
  e2e/            user flows and accessibility checks
```

## Evaluation criteria coverage

| Criterion | How it is addressed | Evidence |
| --- | --- | --- |
| Code quality | Strict TypeScript with no `any`, zero ESLint warnings, Prettier, small single-purpose files, one shared route helper for all API routes, shared input limits for the form and the server, doc comments on every exported function and component | `src/lib/api-route.ts`, `src/domain/limits.ts`, `src/components/household/`, `.github/workflows/ci.yml` |
| Security | Server-only API key, Zod validation on every route, 32 KB body limit, rate limiting, CSP and other security headers, user text passed to the model as untrusted data, model output never rendered as HTML | `src/lib/http.ts`, `src/ai/sanitize.ts`, `next.config.mjs`, `SECURITY.md` |
| Efficiency | Air quality and AI responses cached, one model call per plan, structured JSON output, retries with a time budget, no heavy client libraries | `src/lib/cache.ts`, `src/ai/model-chain.ts` |
| Testing | 490+ unit and component tests (about 98% statement and 92% branch coverage; CI fails below 95% and 88%), plus 37 Playwright end-to-end and accessibility tests | `tests/unit`, `tests/e2e`, `vitest.config.mts` |
| Accessibility | Semantic HTML, skip link, keyboard-only flow, visible focus, AQI shown with text and not colour alone, three languages, axe checks in unit and end-to-end tests | `src/components`, `tests/unit/helpers/axe.ts`, `tests/e2e` |
| Problem statement alignment | Personal hour-by-hour plan from live AQI, safer time windows, low-emission travel swaps, indoor air fixes, air-cleaning plants, going-out advice, what-if questions and a community advisory, with the impact of every choice in numbers | `src/domain`, `src/components/PlanResults.tsx` |
| Google services | Gemini API through the official `@google/genai` SDK, with structured output and a three-model fallback chain | `src/ai/gemini.ts`, `src/ai/model-chain.ts` |

## Data and method notes

- Air quality data comes from Open-Meteo, which is modelled data and can differ from a nearby monitoring station.
- AQI categories follow India's National AQI bands, calculated in `src/domain` from PM2.5 and PM10.
- Exposure is an estimate based on pollutant level, time spent and activity level. It is meant for comparing choices, not for medical use.
- Emission figures use fixed per-kilometre factors listed with their sources in `src/domain/factors.ts`.
- AuraGuide AI gives general guidance. It does not replace advice from a doctor.

## Built with

Google Antigravity was used for AI-assisted development throughout this project.

## Author

Animesh Banerjee, [@animeshrick](https://github.com/animeshrick)
