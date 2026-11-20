# AuraGuide AI

A GenAI assistant that helps families and communities get through severe winter smog and urban air pollution. It turns live air quality data into a personal daily plan and shows, in numbers, what each choice changes.

Built for PromptWars Virtual, Challenge 6: Urban Air Quality Assistant (Hack2skill and Google for Developers).

- Live app: https://auraguide-ai.challenge6.workers.dev/
- Demo video: `<ADD VIDEO URL>`
- Build post: `<ADD LINKEDIN POST URL>`

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
| Fallback plan | A rule-based plan is shown if the AI service or the data source is unavailable |

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

Gemini returns structured JSON. The response is validated against a schema before anything is shown. If validation fails, the app falls back to the rule-based plan.

## Architecture

```
Browser (Next.js UI)
   |
   |  POST /api/plan, /api/whatif, /api/advisory
   v
Next.js API routes (server)
   |-- validate input (Zod)
   |-- rate limit per client
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
- Deployed on `<Google Cloud Run / Vercel>`

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

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side key from Google AI Studio |
| `GEMINI_MODEL` | Yes | Model name to call |
| `RATE_LIMIT_PER_MINUTE` | No | Requests allowed per client per minute |

Only `.env.example` is committed. Real keys are never in the repository.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests with coverage |
| `npm run test:e2e` | Playwright and axe tests |

## Project structure

```
src/
  app/            pages and API routes
  components/     UI components
  domain/         impact engine: AQI category, exposure, emissions, safe windows
  ai/             prompts, Gemini client, response schemas
  lib/            air quality client, cache, rate limiter, validation
  i18n/           English, Hindi, Bengali strings
tests/
  unit/           engine, validation and schema tests
  e2e/            user flows and accessibility checks
```

## Evaluation criteria coverage

| Criterion | How it is addressed | Where |
| --- | --- | --- |
| Code quality | Strict TypeScript, small pure functions, lint and format checks in CI | `src/domain`, `.github/workflows` |
| Security | Server-only API key, schema validation, rate limiting, security headers, user text passed to the model as untrusted data, model output never rendered as HTML | `src/lib`, `src/ai`, `SECURITY.md` |
| Efficiency | Cached air quality and AI responses, one model call per plan, structured output, no heavy client bundle | `src/lib/cache.ts`, `src/ai` |
| Testing | Unit tests on every engine function and edge case, end-to-end tests on the main flows. Coverage: `<ADD %>` | `tests/` |
| Accessibility | Semantic HTML, keyboard-only flow, visible focus, AQI levels shown with text and not colour alone, axe tests with zero violations | `src/components`, `tests/e2e` |
| Problem statement alignment | Low-emission routines, indoor air fixes, sustainable alternatives, location and lifestyle personalisation, and the impact of each choice explained | Whole app |

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