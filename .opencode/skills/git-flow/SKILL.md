---
name: Git flow
description: Branch, commit, PR and GitHub Pages deploy conventions for Medidor AYA. Load before committing, pushing or opening a PR.
---

# Git flow

## Before committing

```sh
npm test
```

If it fails, do not commit. There is no build step: the site is the `public/`
folder exactly as committed.

## Branches

- `feat/<topic>` for features.
- `fix/<topic>` for bugs.
- `chore/<topic>` for scaffolding, CI or tooling.
- `docs/<topic>` for documentation.
- `main` is always deployable: Pages publishes from it.

## Commits

Conventional Commits, English subject, imperative, ≤ 72 characters:

```text
feat(domain): ARESEP billing with IVA on the whole aqueduct
fix(sync): keep the in-memory state on refresh
docs: cycle close instructions
chore(ci): publish public/ to Pages without a build
```

One commit per logical unit. Do not mix refactor, feature and formatting.

## PR

```sh
gh pr create --fill
```

The body must include:

- what changed and why;
- commands run (`npm test`);
- risks or pending debt;
- screenshots if the UI changed.

Do not merge without green checks. Merge with squash and delete the branch.

## Forbidden

- `git push --force` (even with lease) unless the user explicitly asks for it.
- Committing `node_modules/`, `dist/`, `.env`, tokens or `*.local`.
- Rewriting `main` history without an explicit request.
- Committing tokens, credentials or `.env`.
- Lowering the Node version without updating CI and `package.json` engines.

## Deploy

`.github/workflows/pages.yml` runs on every push to `main`:

1. `actions/setup-node` with Node 22.
2. `npm test`.
3. `actions/configure-pages`.
4. `actions/upload-pages-artifact` with `path: public`.
5. `actions/deploy-pages`.

GitHub Pages must be configured with `build_type: workflow`. The site lives at
`https://andres3336.github.io/medidor/`; every path is relative, so it works from
that subpath.

## If something breaks

- Check that `public/index.html` and the assets are served from the correct base
  path.
- If Pages fails, verify that the repo is still public and that Pages has
  permission.
- `public/.nojekyll` must stay in the deployed folder.
