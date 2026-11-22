# Security

AuraGuide AI takes a household description, fetches public air quality data and asks Gemini to write
plain-language text. It stores nothing on the server. This file explains how the app is protected and how to
report a problem.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on
this repository (Security tab, "Report a vulnerability"), or contact the maintainer directly. Include the steps
to reproduce the problem and the version or commit you tested. You can expect a first reply within a few days.

## What the app protects against

| Risk                            | What the app does                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaked API key                  | `GEMINI_API_KEY` is read only in server code (`src/ai/model-chain.ts`). It has no `NEXT_PUBLIC_` prefix, is never sent to the browser, and `.env*` files are in `.gitignore`. `.env.example` holds placeholders only.                                                                                            |
| Prompt injection                | Free text from the person (names, city, activities, what-if questions) is cleaned in `src/ai/sanitize.ts` (control characters removed, length capped) and passed to the model inside labelled `<untrusted_...>` JSON blocks. The system instruction tells the model to treat those blocks as data.               |
| Model invents numbers           | The model never calculates anything. Exposure and emissions come from `src/domain`. The model's reply is checked with Zod (`src/ai/schemas.ts`), then every number is overwritten with the engine's value. If no model gives a valid reply, the API returns an "AI unavailable" error and shows nothing made up. |
| Cross-site scripting            | Model text is shown only as React text nodes. There is no `dangerouslySetInnerHTML` anywhere in the app. Unit and end-to-end tests check that HTML in model output stays as plain text.                                                                                                                          |
| Malformed or oversized input    | Every API route validates its body with Zod. Request bodies over 32 KB are rejected. Field lengths, member counts and activity counts are capped.                                                                                                                                                                |
| Abuse and cost                  | Each route is rate limited per client (`RATE_LIMIT_PER_MINUTE`, default 30). Open-Meteo answers are cached (30 minutes for live data, 24 hours for place lookups). Gemini plans and texts are cached for 15 minutes, and Gemini calls have a timeout.                                                            |
| Clickjacking, sniffing, framing | Security headers are set in `next.config.mjs`: a Content Security Policy (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and, in production, HSTS. `X-Powered-By` is turned off.                     |
| Information leaks in errors     | API errors return a short code and a message written for the person. Stack traces and upstream errors are logged on the server only, without request contents.                                                                                                                                                   |
| Unsafe outbound links           | The WhatsApp share link uses `rel="noopener noreferrer"`.                                                                                                                                                                                                                                                        |

## Privacy

- The household profile is sent to this app's own API to build the plan. It is not saved on the server.
- The browser keeps the last profile and language in `sessionStorage`, which is cleared when the tab closes.
- The city name is sent to Open-Meteo to find the location and the air quality forecast. Names of household
  members and activity descriptions are sent to Gemini only when a Gemini key is configured. Do not enter real
  names if that is a concern, since the plan works the same with first names or nicknames.
- There are no analytics, ad scripts or third-party cookies.

## Known limits

- The rate limiter and caches live in memory. On a serverless host each instance has its own counters, so the
  effective limit is per instance. For a public launch with real traffic, move both to a shared store such as
  Redis or an edge rate-limit service.
- The client address comes from `x-forwarded-for`. Deploy behind a host that sets this header itself, such as
  Vercel. Behind a proxy that does not overwrite it, a caller could vary it to avoid the limit.
- The Content Security Policy allows inline scripts and styles because Next.js needs them. A nonce-based policy
  would be stricter and is a possible later improvement.
- Air quality values come from a forecast model, not a sensor at the person's address. The app says so on the
  results page and falls back to a typical winter pattern, clearly labelled, when the data source is unreachable.

## Keeping dependencies safe

CI runs lint, type checks, unit tests and end-to-end tests on every pull request. Run `npm audit` before a
release and update dependencies that have fixes.
