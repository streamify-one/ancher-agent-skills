# Releasing

`@ancher-ai/agent-skills` is developed in a private monorepo and published to
npm from there; this public repository is a read-only, identity-scrubbed
mirror synced by CI. Releases follow the same flow as `@ancher-ai/sdk` and
`@ancher-ai/cli` (see the monorepo's `.github/workflows/publish-npm.yml`).

## Cutting a release (maintainers, in the monorepo)

1. Bump `version` in `apps/agent-skills/package.json` to `X.Y.Z`; merge to
   `main` via PR.
2. Publish a GitHub Release on the monorepo whose tag is **`skills-vX.Y.Z`**
   (the tag prefix selects the package; the version must match
   `package.json`).
3. `publish-npm.yml` maps the tag to `@ancher-ai/agent-skills`, verifies
   version == tag, re-runs the package gates (`check`, `test`), packs, and
   publishes via **OIDC trusted publishing** with provenance — no long-lived
   npm token.

The package ships source directly (no build step), so the pack step publishes
the `files` list from `package.json` as-is.

## Prerequisites (once)

- Configure the npm **Trusted Publisher** for `@ancher-ai/agent-skills`
  pointing at the monorepo and workflow `publish-npm.yml` (org
  `streamify-one`). The first-ever publish may need to be done manually from a
  laptop (`npm publish --access public`) because the Trusted Publisher setting
  lives on the package page, which exists only after the first publish.
- The public mirror repo needs nothing — it never publishes.

## Syncing this mirror

The mirror updates automatically on merges that touch `apps/agent-skills/`
(and weekly as a catch-up). Manual sync: run the monorepo's "Sync public
mirrors" workflow with `app: agent-skills`.
