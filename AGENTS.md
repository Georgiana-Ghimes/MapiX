# AGENTS.md

## Project Context

MapiX is a user-owned React + Express + PostgreSQL app. Keep changes focused on the user's request and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and run commands.

## Key Files

- `src/`: frontend application source.
- `src/api/client.js`: frontend API client (entities + auth).
- `server/`: Express API and PostgreSQL migrations.
- `server/.env`: local-only environment values; never commit secrets.
- `vite.config.js`: Vite config with `/api` proxy to the local API.

## Working Notes

- Use `npm run dev:server` for the local API (port 3003) and `npm run dev` for the frontend.
- Prefer the existing entity API surface in `src/api/client.js` before adding ad-hoc fetch helpers.
- Schema changes go through `server/src/migrate.js`.
- Run the relevant checks from `package.json` before finishing code changes.
- App version/build live in root `package.json` (`version` + `build`; sync `version` in `server/package.json`) and show on login + sidebar as `vX.Y.Z · build N`. **Before every meaningful commit**, bump per `.cursor/rules/semver-commit-push.mdc` (PATCH/MINOR/MAJOR + build always +1).
