# AuraGuide AI

A GenAI assistant that helps families and communities get through severe winter smog and urban air pollution. It turns live air quality data into a personal daily plan and shows, in numbers, what each choice changes.

Built for PromptWars Virtual, Challenge 6: Urban Air Quality Assistant (Hack2skill and Google for Developers).

- Live app: https://aura-guide-ai.vercel.app/
- Demo video: https://www.loom.com/share/c1bbf9c7060f441eb2ebc78daa055cfb
- Build post: https://www.linkedin.com/feed/update/urn:li:activity:7529590080232042496/

## Chosen vertical

**Challenge 6: Urban Air Quality Assistant.** The persona is an urban Indian household on a smog day, with a mix of members whose needs differ: a commuter, a homemaker, a child on the school run, an elderly parent, a pregnant member, someone with asthma. A second persona is the community organiser (a housing society, school or neighbourhood group) who needs a notice to share.

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
| 3-day outlook | Shows the next three days with daytime AQI, a plain verdict, the cleanest time to go out and the best day for outings, laundry and errands |
| Sensitive profiles | Tighter thresholds for asthma, pregnancy, infants, elderly people and outdoor workers |
| Indoor air module | Guidance on cooking fuel, incense and coils, ventilation timing and purifier use |
| What-if chat | Ask "what if I cycle instead of taking an auto?" and the engine recalculates before Gemini explains |
| Community mode | Generates a shareable daily advisory for a housing society or school |
| Languages | English, Hindi and Bengali, with wording adapted for elders and children |
| Demo households | One tap loads a sample family so the full flow can be seen in seconds |
| Model fallback chain | A busy Gemini model is retried, then the next model in the chain is used. If no model answers, the app says so clearly instead of guessing |

## Approach and decision logic

The app decides from the household's own context, not from generic tips. A deterministic engine (`src/domain`) makes every decision that involves a number; Gemini then explains those decisions in plain words.

| Context the person gives | Decision the app makes |
| --- | --- |
| Health sensitivities (asthma, infant, pregnancy, elderly, cardiac, outdoor work, smoking) | Weights that member's exposure higher (the highest factor counts, not the sum), so the plan protects them first |
| How each member travels | Estimates breathing rate and roadside pollution for that mode, and suggests a lower-exposure, lower-emission swap (for example car to metro) |
| Stays at home (homemaker, work from home) | Counts no commute exposure or emissions, so the plan focuses on indoor air |
| Usual outdoor activities and their hours | Moves each one to the day's cleanest window when that is cleaner than the usual hour |
| Cooking fuel, incense or coils, purifier | Adds indoor sources to the exposure estimate and gives matching indoor advice |
| City | Fetches live hourly air quality and finds the cleanest windows today and the best day in the next three |
| A what-if question | Recalculates exposure and emissions for the change before Gemini explains it |

If Gemini cannot answer, the app returns a clear error rather than inventing a plan. The engine's numbers are never taken from the model.

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

## Environment variables

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

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layers, the request flow, how Gemini is used and the main design decisions.

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
| Code quality | Strict TypeScript with no `any`; ESLint enforces, in CI, functions of at most 60 lines, complexity of at most 10, nesting depth of at most 3, at most 4 parameters and files of at most 250 lines; a pure engine with no I/O; one shared route helper for all API routes; shared UI building blocks and style constants; input limits shared by the form and the server; doc comments on every function, component and domain type | `ARCHITECTURE.md`, `eslint.config.mjs`, `src/lib/api-route.ts`, `src/domain/limits.ts` |
| Security | Server-only API key, Zod validation on every route, 32 KB body limit, rate limiting, CSP and other security headers, user text passed to the model as untrusted data, model output never rendered as HTML | `src/lib/http.ts`, `src/ai/sanitize.ts`, `next.config.mjs`, `SECURITY.md` |
| Efficiency | Air quality and AI responses cached, one model call per plan, structured JSON output, retries with a time budget, no heavy client libraries | `src/lib/cache.ts`, `src/ai/model-chain.ts` |
| Testing | 520 unit and component tests (about 98% statement and 92% branch coverage; CI fails below 95% and 88%), plus 37 Playwright end-to-end and accessibility tests | `tests/unit`, `tests/e2e`, `vitest.config.mts` |
| Accessibility | Semantic HTML, skip link, keyboard-only flow, visible focus (also in Windows high contrast mode), no animation or smooth scrolling when the system asks for reduced motion, AQI shown with text and not colour alone, three languages, axe checks in unit and end-to-end tests | `src/components`, `src/app/globals.css`, `tests/unit/helpers/axe.ts`, `tests/e2e` |
| Problem statement alignment | Personal hour-by-hour plan from live AQI, safer time windows, a 3-day outlook, low-emission travel swaps, indoor air fixes, air-cleaning plants, going-out advice, what-if questions and a community advisory, with the impact of every choice in numbers | `src/domain`, `src/components/PlanResults.tsx` |
| Google services | Gemini API through the official `@google/genai` SDK, with structured output and a three-model fallback chain | `src/ai/gemini.ts`, `src/ai/model-chain.ts` |

## Assumptions

- **Data:** air quality comes from Open-Meteo's forecast model, which can differ from a nearby monitoring station. If it cannot be reached, a typical winter-smog pattern (India Standard Time) is used and clearly labelled as modelled.
- **AQI:** categories follow India's National AQI bands, calculated from PM2.5 and PM10; the higher sub-index wins.
- **A fixed daily routine** so the normal and optimised days are compared fairly: commutes at 08:00 and 18:00, commuters away from home 09:00 to 17:00. The values are in `DAY_MODEL` in `src/domain/factors.ts`.
- **Indoor air:** closed windows let in about 65% of outdoor particles, a HEPA purifier removes about 80%, and biomass cooking and incense add fixed amounts of indoor PM2.5.
- **Masks:** an everyday N95 is assumed to let through 40% of particles, not the 5% of a lab-fitted mask, so the benefit is not overstated.
- **Emissions** use fixed per-kilometre factors for Indian transport, with sources listed in `src/domain/factors.ts`.
- **Health weights** are estimates for comparing choices, not clinical figures.
- **3-day outlook:** each day is judged on its waking hours (07:00 to 21:00) and needs at least 8 of them to be shown. A daytime average up to AQI 100 is a good day, up to 200 means keep outings short, and above that means stay in where possible.
- **Privacy:** the household profile is not stored on the server; the browser keeps it only for the current tab.
- AuraGuide AI gives general guidance. It does not replace advice from a doctor.

## Built with

Google Antigravity was used for AI-assisted development throughout this project.

## Author

Animesh Banerjee, [@animeshrick](https://github.com/animeshrick)
