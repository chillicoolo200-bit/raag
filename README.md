# CelebrAI — অনুষ্ঠান বন্ধু

This repository contains the current source snapshot for the public CelebrAI event-planning app.

- Live app: https://celebrai-ai-event.hatchable.site
- Hosting project: CelebrAI — AI Event Planner (Hatchable)
- Frontend: Bengali/English event planner with deterministic budget allocation, timelines, validation and replanning.
- Backend: public API routes under `api/` for AI assistance, plan generation and plan review.
- Database: PostgreSQL rate-limit table migration in `migrations/`.
- Configuration: `hatchable.toml`.

## Source layout

The root-level `index.html`, `app.js`, `core.js`, `style.css`, and `extra.css` mirror the deployed project's `public/` files. The `api/`, `migrations/`, and `hatchable.toml` files mirror the deployed backend and configuration.

The app's core plan calculations run in the browser. The AI assistance panel calls `/api/assist`; generated suggestions should be checked against local vendors, permissions, safety requirements and real quotes. AI output is not a booking or a verified price.

## QA

See [QA-REPORT.md](QA-REPORT.md) for the checks performed against the live deployment and the remaining checks that have not been completed.

## Deployment

The production app is hosted on Hatchable. Changes committed here are a source backup; they do not automatically deploy to Hatchable unless a separate deployment workflow is configured.
