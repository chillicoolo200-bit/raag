# অনুষ্ঠান বন্ধু (Anushthan Bondhu)

A GenAI-assisted event planner for **neighbourhood pujas, college fests, birthdays and family functions** in
West Bengal. Built for PromptWars Virtual, Challenge 5 (*Celebration & Event Planner*). Works in Bengali and English
and is designed for a phone screen.

**Chosen vertical / persona:** a volunteer organiser of a para puja or college fest: small budget, short time,
many people to coordinate. Birthdays and family events (weddings, annaprashan) use the same engine.

## What it does

1. **Asks a few practical questions:** event type, date, number of guests, total budget, vegetarian-only, free-text notes.
2. **Splits the budget** by category (always adds up to the exact total, with a 10% contingency fund) and warns when the
   budget per guest or food per guest looks too low, naming what to trim first.
3. **Builds a timeline backwards from the event date**, with dependencies ("no permission, no sound booking") and
   "ask the vendor these questions before you book" checklists.
4. **Re-plans when something changes:** a task is late, the date moves, the budget or guest count changes. It shows exactly
   which tasks moved, which budget lines changed and which new warnings appear.
5. **Uses Gemini for the creative part:** a "do this first" step, 5 personalised ideas, 3 ways to spend less, and a
   ready-to-send WhatsApp message (contribution request for a puja, sponsorship request for a fest, invitation otherwise).

## How it works

```
Browser (index.html, app.js, core.js)  --POST /api/assist-->  api/assist.js -> assist-handler.js -> Gemini
        |                                                              |
   plan = core.js (instant, offline)                       validate -> prompt -> parse -> clean
                                                           (falls back to built-in templates on any failure)
```

* **Code decides the numbers.** Money, dates, dependencies and re-planning are pure functions in `core.js`
  (no network, no randomness), so they are exact and testable. The AI is never asked to do arithmetic.
* **Gemini decides the words.** The server sends the real plan (budget lines, first tasks) as context and asks for JSON only.
  Output is parsed, length-limited and stripped of angle brackets before it reaches the browser.
* **Always an answer.** If the API key is missing, the quota is used up, the model is unavailable, the call is slow or the
  answer is malformed, the app shows built-in templates and says why on screen (for example "no API key set").
* **Model names change**, so the handler tries `gemini-flash-latest`, then `gemini-3.5-flash-lite`, then `gemini-3.6-flash`.
  Override with `GEMINI_MODEL` (comma-separated).

## Run and test

```bash
npm test            # 43 tests, Node 20+, no dependencies, no network, no API key needed
```

Deploy on Vercel: import this repository, add the environment variable `GEMINI_API_KEY`
(a free key from Google AI Studio), deploy. There is no build step.

## Quality notes (mapped to the evaluation areas)

| Area | What was done |
|---|---|
| Code quality | Small pure functions, one responsibility per file, no dependencies, comments explain *why*. |
| Security | API key only in an environment variable and never returned or logged; every input validated and length-limited; user notes are sent to the model as quoted data with an instruction not to follow them; AI output is sanitised and rendered with `textContent` (never `innerHTML`); strict Content-Security-Policy and other headers in `vercel.json`; per-IP rate limit. |
| Efficiency | One AI call per plan, 8.5 s deadline, plan computed in the browser, no build step, no runtime dependencies. |
| Testing | 25 tests for the planning logic (budget always adds up, dependency order, compression, re-planning, bad input) and 18 for the API (success, model fallback, 403/429, timeout, malformed output, prompt-injection text, rate limit, key never leaks), all with a fake Gemini. |
| Accessibility | Semantic landmarks and headings, labelled fields, error summary with `aria-describedby`, live regions for status, focus moved to results, keyboard-visible focus ring, 44px touch targets, text (not colour) for status, `lang` switches with the language, print stylesheet. |
| Problem alignment | Dynamic assistant that asks occasion, budget and headcount, turns a vague goal into an ordered task list, and re-plans when a booking is delayed. |

## Assumptions

* Budget shares per event type, minimum food per guest (₹20 to ₹80 depending on type), the ₹50 minimum total per guest and the
  task lead times are reasonable rules of thumb, not official figures. They are easy to change at the top of `core.js`.
* Permissions, loudspeaker rules and prices differ by place. The app only reminds the organiser to ask the local office or vendor.
* Amounts are in Indian rupees; dates use the organiser's local calendar day.
* No user data is stored. Requests are processed and discarded.
* The rate limiter is in memory, so on serverless hosting it is best-effort per warm instance.

## Files

`index.html`, `style.css`, `app.js` (interface) · `core.js` (planning logic) · `assist-handler.js` and `api/assist.js`
(server) · `core.test.js`, `assist.test.js` (tests) · `DESIGN.md` (design notes) · `vercel.json` (security headers).
The server logic sits at the top level, with a one-line `api/assist.js` that re-exports it, so the project can be
uploaded file by file from a phone.

## How AI was used

The application calls the **Gemini API** at run time for ideas, tips and the message draft. The code, tests and this
documentation were drafted with **Claude** by prompting and then run and reviewed.
