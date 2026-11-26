# Contributing

Thanks for helping with AuraGuide AI. This page covers how to set the project up and what a change needs before it is merged.

## Setup

1. Use Node 20.19 or newer (`.nvmrc` has the version CI uses).
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and add a Gemini API key.
4. Run `npm run dev` and open http://localhost:3000.

## Before you open a pull request

Run the same checks CI runs:

```
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Conventions

- **Layers.** Calculations live in `src/domain` as pure functions with no I/O. Network calls, React state and HTTP handling stay in `src/lib`, `src/hooks`, `src/components` and `src/app`. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Small units.** ESLint enforces functions of at most 60 lines, complexity of at most 10 and files of at most 250 lines. Split a function instead of switching a rule off.
- **Types.** No `any`. Give exported functions and hooks explicit return types.
- **Settings.** Read environment variables only through `src/lib/env.ts`.
- **Logging.** Use `src/lib/logger.ts`. Never log prompts, API keys or household details.
- **Text.** Every string a user sees goes in all three files in `src/i18n` (English, Hindi, Bengali).
- **Tests.** Add or update a test with every change in behaviour. CI fails below 95% statement and 88% branch coverage.
- **Accessibility.** New UI must pass the axe checks and work with the keyboard alone. Colour must never be the only signal.

## Commit messages

Write a short summary in the imperative mood that says what changed, for example `Validate Open-Meteo responses with Zod`. Add a body when the reason is not obvious.
