# Notion recipe apps

Two Android apps (Capacitor 8, plain JS) and a Mac app (Electron, plain JS) for your own Notion recipe databases, plus the
Claude skills that fill them.

- `brew-book/`: beer recipes.
- `recipe-book/`: cooking recipes (read-only; recipes come from the JSON in each page's "App data" toggle).
- `recipe-book-mac/`: the same Recipe book for macOS, with a desktop layout. `www/app.js` mirrors the Notion, App data
  and quantity code from `recipe-book/www/app.js`; when the App data format changes, update both. Notion requests go
  through `main.js` (allow-listed hosts only), because Notion blocks browser requests.
- `skills/`: generic versions of both Claude skills.

## Rules

- Never build a Notion token into these apps, and never hardcode data source IDs. Setup searches Notion for a data
  source with the marker columns, or creates the database under a page the integration can see. Keep that setup and
  discovery code intact.
- App IDs are `io.github.pvandenboer_alt.*`.
- The Mac app has no Apple developer certificate: it is signed ad hoc in `build/adhoc-sign.js`. Keep that step, or the
  app won't open on Apple silicon.

## Build and release

Each workflow runs on pushes to `main` that touch its folder and updates a rolling release with a stable download URL:

- `brew-book.yml` → release `brew-book` (`BrewBook.apk`)
- `recipe-book.yml` → release `recipe-book` (`RecipeBook.apk`)
- `recipe-book-mac.yml` → release `recipe-book-mac` (`RecipeBook-mac-arm64.dmg`, `RecipeBook-mac-x64.dmg`), built on a
  macOS runner. The app checks this release's title for updates.
- `skills.yml` → release `skills` (skill zips)

Versions are 1.N where N is the run number. APKs are signed with the key in the `ANDROID_KEYSTORE_BASE64` secret;
keep the explicit signing step or updates won't install over earlier versions. `android/` is generated in CI.

## Testing

No automated tests. Check changes by serving a copy of the app's `www/` with a fake `fetch` answering the Notion
endpoints. For the Mac app, fake `window.rb.http` instead (see `recipe-book-mac/preload.js` for its shape).

## Maintenance

- A weekly maintenance check may open pull requests; it never pushes to `main`, merges or creates releases.
- Dependabot opens monthly update PRs (minor and patch grouped, majors one at a time). Merging one ships a new build.
- Docs-only commits to `main` can carry `[skip ci]` in the message so they don't build a release.
- This repo is public. Nothing personal goes in commits, PRs, issues or files: no names, emails (commit with the
  GitHub noreply address), Notion page or database IDs, tokens, usernames or locations.
