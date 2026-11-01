# CelebrAI QA report

**Checked:** 2026-11-01  
**Deployment checked:** public CelebrAI site, v20  
**Result:** the tested flows passed; this is not a 100% correctness or security certification.

## Browser checks

- Tested at 390×844, 768×1024 and 1440×900.
- No horizontal overflow at the tested viewport sizes.
- One main landmark, skip link present, no duplicate element IDs.
- Visible controls had accessible names in the corrected audit (including radio inputs through their labels).
- Created a birthday plan with 100 guests and a ₹50,000 budget.
- Confirmed the AI assistance panel returned a Gemini response, five ideas, three saving tips and a WhatsApp draft.
- Tested budget, event-date, guest-count and task-delay replanning.
- Tested Bengali/English language switching.

## API checks

- `/api/plan`: valid request returned 200; impossible date and invalid guest count returned 400; GET returned 405.
- `/api/review`: valid request returned 200 with deterministic budget arithmetic; impossible date returned 400.
- `/api/assist`: live Bengali response tested; invalid input returned 400; GET returned 405.
- PostgreSQL rate-limit rows were present for the plan, review and assist routes.
- No 5xx/error logs were found in the checked post-deployment interval.
- Hatchable deployment dry-run returned no errors or warnings.

## Not yet certified

- No sustained load/stress test or penetration test.
- No complete WCAG audit with assistive technology.
- No broad cross-browser/device matrix or extended real-user trial.
- AI suggestions can still be inaccurate; confirm vendor quotes, availability, permissions and safety locally.
- Rate limiting is an abuse-control layer, not DDoS protection.

A passing spot check only describes the tested cases and time window. It does not prove that all bugs or security issues are absent.
