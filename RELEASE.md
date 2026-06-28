# Releasing `@plaidly/node`

Publishing is automated by `.github/workflows/publish.yml`, which runs when a
`v*` tag is pushed: it installs, builds, tests, verifies the tag matches the
`package.json` version, skips if that version is already on npm, then runs
`npm publish --provenance --access public`.

## One-time setup

- **npm**: the package is published under the `@plaidly` scope as a public
  package. The publishing npm account/org must own `@plaidly`.
- **GitHub secret `NPM_TOKEN`**: an npm **automation** access token with
  publish rights to `@plaidly/node`. Add it under
  *Settings → Secrets and variables → Actions*.
- Provenance requires the workflow's `id-token: write` permission (already set).

## Cutting a release

1. Bump `version` in `package.json` (e.g. `0.2.0` → `0.2.1`). Keep it in sync
   with the tag — the workflow fails fast if they differ.
2. Commit on `main`: `git commit -am "release: v0.2.1"`.
3. Tag and push:
   ```bash
   git tag v0.2.1
   git push origin main --tags
   ```
4. Watch the **Publish to npm** workflow. On success the version is live at
   <https://www.npmjs.com/package/@plaidly/node>.

## Manual fallback (only if CI is unavailable)

```bash
npm ci && npm run build && npm test
npm publish --provenance --access public   # needs an authenticated npm session
```

Do **not** publish a version that is already on npm — npm versions are
immutable. Bump the patch instead.
