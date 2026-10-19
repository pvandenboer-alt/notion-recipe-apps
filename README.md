# Brew book and Recipe book

Two free Android apps that turn a Notion database into a recipe book you can actually cook from in the kitchen.

- **Brew book** is for homebrewers. It covers beer recipes with automatic OG, IBU and colour figures, scaling to your own batch size and efficiency, a step-by-step brew day with boil and hop alarms, and a brew log. You can add and edit recipes in the app or let Claude read them from photos of brew sheets and books.
- **Recipe book** is for cooking and baking. It has a photo grid or sortable list of your recipes, filters by cuisine, main ingredient, tags and total time, serving scaling, and a cook mode with step timers that keeps the screen on. Claude adds the recipes from links, photos or cookbook pages, and the app reads them.

Your recipes live in **your own Notion workspace**. The apps talk to Notion directly from your phone, with no server or account in between. Nothing is collected and there's no tracking.

## Install

You need an Android phone and a Notion account (the free plan is fine).

1. **Download the app on your phone:**
   - [Brew book (BrewBook.apk)](https://github.com/pvandenboer-alt/notion-recipe-apps/releases/download/brew-book/BrewBook.apk)
   - [Recipe book (RecipeBook.apk)](https://github.com/pvandenboer-alt/notion-recipe-apps/releases/download/recipe-book/RecipeBook.apk)
2. **Open the downloaded file.** The first time, Android asks you to allow installs from your browser. Allow it, then tap **Install**. The app isn't from the Play Store, so Android may show a warning; that's expected.
3. **Create a Notion integration.** This is the key that lets the app reach your recipes. On a computer:
   1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and choose **New integration**.
   2. Give it a name (for example "Brew book app"), pick your workspace, keep the type **Internal**, and save.
   3. Under **Capabilities**, tick **Read content**, **Update content** and **Insert content**. Recipe book only needs Read content after setup, but Insert content lets it create the database for you.
   4. Copy the **Internal Integration Secret** (it starts with `ntn_`).
4. **Give the integration access to a page.** In Notion, open the page where your recipe book should live, or your existing Brew book / Recipe book database. Tap **•••** → **Connections** and add your integration.
5. **Open the app and paste the secret.** The app finds your database. If you don't have one yet, it offers to create an empty one in the page you shared, with all the right columns.

To update, download the newest APK from the same link and install it over the old one. Your settings and offline copy stay.

One integration can serve both apps. The secret is stored only on your phone, and the integration can only see the pages you connect it to.

## Adding recipes with Claude

The repository includes two [Claude](https://claude.ai) skills that read recipes from photos, links, PDFs or pasted text and save them in exactly the format the apps read. They convert to metric, sanity-check the numbers and flag anything uncertain for you to check.

- **brew-book-recipe** is for beer recipes. It's optional, because Brew book can also add recipes itself.
- **recipe-book** is for cooking recipes. Recipe book is read-only, so this is how recipes get in.

To use them:

1. Download the zips from the [Claude skills release](https://github.com/pvandenboer-alt/notion-recipe-apps/releases/tag/skills).
2. In Claude's settings, find **Skills** (under Capabilities), turn them on, and upload each zip.
3. Connect Notion to Claude (Settings → Connectors) so it can write to your workspace.
4. Send Claude a recipe (a photo, a link, or a few cookbook pages) and say "add this to Recipe book" or "add these to Brew book". New recipes show up in the app as **To review** after the next sync.

Without Claude, you can still add cooking recipes by hand. Each page needs an **App data** toggle heading containing a JSON code block. [`skills/recipe-book/references/extraction-rules.md`](skills/recipe-book/references/extraction-rules.md) describes the format, and [`skills/recipe-book/scripts/build_page.py`](skills/recipe-book/scripts/build_page.py) builds the page for you.

## How it works

- The library list comes from the database columns, in one query. Each recipe's full details come from the JSON in its page's **App data** toggle. The readable page above it is for browsing in Notion.
- Both apps keep an offline copy on the phone, so recipes open without a connection. Photos and Recipe book's cover images load from Notion or the recipe websites when you're online.
- Brew book writes recipes and brew logs back to Notion. Recipe book never changes anything in Notion.

## Build your own copy

The apps are plain HTML, CSS and JavaScript (`brew-book/www`, `recipe-book/www`) wrapped with [Capacitor](https://capacitorjs.com). GitHub Actions builds the APKs, so you don't need Android Studio.

1. Fork this repository and enable Actions on your fork.
2. Optionally change `appId` in `capacitor.config.json` so your build installs next to the official one.
3. Add a signing key, because Android only installs an update over an app signed with the same key. Create one with `keytool -genkeypair -keystore my.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`. Then add the output of `base64 -i my.keystore` as a repository secret called `ANDROID_KEYSTORE_BASE64`. Without this secret, every build is signed with a throwaway key. Never commit the keystore.
4. Push a change under `brew-book/` or `recipe-book/`, or run the workflow from the **Actions** tab. The APK appears under **Releases**.

Never build a Notion secret into the app. Anyone who downloads an APK can read what's inside it, which is why the apps ask for the secret on the phone instead.

To try the web app in a browser, serve the `www` folder with any static server. Notion's API doesn't allow browser requests (CORS), so it only connects when running as the Android app.

## Licence

[MIT](LICENSE). Use it, change it, share it.
