# Architecture

AuraGuide AI is a single Next.js app. The browser collects a household profile; three API routes look up air quality, run a deterministic engine and ask Gemini to explain the result. This document explains how the code is organised and why.

## Principles

1. **The engine decides, the model explains.** Every number a user sees (AQI, exposure, emissions, safe windows, the 3-day outlook) is calculated in `src/domain`. Gemini only writes wording around those numbers, and its reply is checked against a schema before it is used.
2. **No silent guessing.** If Gemini or the air quality service cannot answer, the user is told. The app never invents a plan.
3. **Pure core, thin edges.** Business logic is plain TypeScript functions with no I/O, so it is easy to test. Network calls, React state and HTTP handling stay at the edges.
4. **Small units.** ESLint enforces the limits in CI: functions of at most 60 lines, cyclomatic complexity up to 10, nesting depth up to 3, at most 4 parameters, files up to 250 lines.

## Layers

```
src/
  domain/      Pure engine. No imports from other layers.
  ai/          Gemini: prompts, schemas, model fallback chain, error types.
  lib/         Server and browser helpers: air quality client, HTTP, rate limit, cache, API client.
  app/         Next.js page, layout and the three API routes.
  components/  React UI. Larger panels keep their parts in subfolders.
  hooks/       Page state and request handling for the UI.
  i18n/        English, Hindi and Bengali strings.
```

`domain` is the core and imports nothing from the other layers, so the engine can be tested on its own. `ai` uses `domain` and the cache in `lib`; the shared route helper in `lib` uses the Gemini error type from `ai`; `hooks` reuse the request schema from `ai` to check stored data; `components` use `domain`, `lib`, `hooks` and `i18n`; the `app` routes connect them.

| Folder           | What lives there                                                                                                                     | Examples                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `src/domain`     | AQI maths, exposure and emissions models, safe windows, outlook, what-if, outing advice, plants, shared input limits, types          | `aqi.ts`, `exposure.ts`, `outlook.ts`, `limits.ts`        |
| `src/ai`         | Prompt builders, request and response schemas, the Gemini client, retries and model fallback, error classification, input sanitising | `gemini.ts`, `model-chain.ts`, `prompts.ts`, `schemas.ts` |
| `src/lib`        | Open-Meteo client, shared API route helper, rate limiter, caches, typed browser API client, formatting                               | `open-meteo.ts`, `api-route.ts`, `api-client.ts`          |
| `src/app`        | `page.tsx`, `layout.tsx`, error pages, `api/plan`, `api/whatif`, `api/advisory`                                                      | `api/plan/route.ts`                                       |
| `src/components` | Presentational components. `household/`, `whatif/`, `advisory/` and `outing/` hold the parts of bigger panels                        | `PlanResults.tsx`, `household/MemberCard.tsx`             |
| `src/hooks`      | Page session, language choice, session storage, cancelling stale requests                                                            | `usePlanSession.ts`, `useLatestRequest.ts`                |

## Request flow: making a plan

```
Browser form
  -> POST /api/plan                          (src/app/api/plan/route.ts)
       createJsonRoute                       (src/lib/api-route.ts)
         1. rate limit per client
         2. read the body (size limit 32 KB)
         3. validate with Zod                (src/ai/schemas.ts)
       resolveAirQuality                     (src/lib/air-quality-service.ts)
         geocode the city, fetch 4 days of hourly PM2.5/PM10 from Open-Meteo, cache it
       computeEngineFacts                    (src/domain/engine.ts)
         exposure, emissions, safe windows, 3-day outlook
       generateOptimizedPlanWithGemini       (src/ai/gemini.ts)
         prompt with the engine's facts, structured JSON output,
         retries and model fallback          (src/ai/model-chain.ts),
         validate the reply                  (src/ai/gemini-schema.ts),
         merge with the engine's numbers     (finalizeGeminiPlan)
  <- DailyPlanResponse                       (src/ai/plan-schema.ts)
```

The what-if and advisory routes follow the same pattern through the same `createJsonRoute` helper: validate, look up air quality, let the engine calculate, then ask Gemini for wording.

## Gemini usage

- One call per plan, what-if question or advisory. Replies are cached for 15 minutes.
- The model chain is `GEMINI_MODEL`, then `GEMINI_MODEL_2` and `GEMINI_MODEL_3`. A busy model is retried twice with a growing wait, then the next model is tried. A bad or missing key stops at once. The whole request has a 60-second budget.
- Errors are reduced to one short reason (`invalid_key`, `quota`, `service_error` and so on) by a rule table in `gemini-errors.ts`. Only the reason and a short message are logged, never prompts, keys or household details.
- Text typed by users is sanitised and placed in a marked data block, so the model treats it as data rather than instructions.

## Front end

- `usePlanSession` owns the page state. It keeps only the newest request alive (`useLatestRequest`), re-requests the plan when the language changes, and restores the household for the current tab from session storage.
- The household form keeps all state in `useHouseholdForm` and `useMemberList`; the form components only render.
- Shared building blocks remove repetition: `SectionHeader`, `VerdictCard`, `LocalizedAQIBadge`, `RequestErrorBanner`, `LabelledSelect`, `TextField`, `NumberField` and the style constants in `styles.ts` and `household/fieldStyles.ts`.
- Colour is never the only signal: every AQI value is shown with its number and category name, and verdicts have an icon and text.

## Testing

| Level      | Tool                              | What it covers                                                                                                           |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit       | Vitest                            | Engine maths, outlook, prompts, schemas, Gemini retries and error mapping, Open-Meteo parsing, rate limiting, API routes |
| Component  | Vitest, Testing Library, axe-core | Every panel, the form, language switching, accessibility checks                                                          |
| End to end | Playwright, axe-core              | Full flows in a real browser against a production build, security headers, input handling                                |

CI runs lint, formatting, type checks, unit tests with coverage limits, a production build and the end-to-end tests on every push.

## Key decisions

| Decision                                           | Why                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Deterministic engine plus Gemini for wording       | Health numbers must be repeatable and testable; language models are good at explaining, not at arithmetic |
| Fail clearly instead of a rule-based fallback plan | A made-up plan presented as personal advice would be misleading                                           |
| Open-Meteo for air quality                         | Free, no key, hourly forecasts for any city with PM2.5 and PM10                                           |
| In-memory cache and rate limiter                   | Enough for a single small deployment; they reset per server instance                                      |
| Input limits in one file (`domain/limits.ts`)      | The form and the server always agree on what is valid                                                     |
