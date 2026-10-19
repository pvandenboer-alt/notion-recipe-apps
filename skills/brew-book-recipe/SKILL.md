---
name: brew-book-recipe
description: Adds beer recipes to the user's Brew book database in Notion, and corrects or updates recipes already there. Use whenever the user shares a photo, scan, screenshot, link or typed text of a beer or homebrew recipe (including Dutch brew sheets and pages from brewing books), or asks to add, save, import, log, fix or update a recipe in Brew book, their recipe library or Notion, even if they don't name the skill. Reads the recipe, converts it to metric, sanity-checks the numbers and writes it in the exact format the Brew book Android app reads.
---

# Brew book recipe import

The user keeps their beer recipes in a Notion database called Brew book. The Brew book Android app reads that database, so every page needs the same structure, including a JSON "App data" block the app parses. This skill turns whatever they hand you into that structure and saves it.

Read `references/extraction-rules.md` before extracting anything. It covers units, Dutch brew sheets and the timing conventions that cause most misreads. Read `references/notion-format.md` when updating or deleting a recipe, or before the first save in a conversation, to find the database.

## Find the database first

Search Notion for "Brew book" and fetch the database. Take the data source ID from its `collection://` URL and use it for the rest of the conversation. If there is more than one, ask which to use. If there is none, offer to create it with the schema in `references/notion-format.md` (the Brew book app can also create it during its setup).

## Adding recipes

### 1. Work out what you've been given

- Photos: decide which photos belong to the same recipe (consecutive pages of one recipe) and which are separate recipes. If it's genuinely unclear, ask once.
- A link: fetch the page and extract from it. The source is the site name.
- Typed or pasted text: extract from it directly.

Several recipes at once is normal; handle them one after another and report them together at the end.

### 2. Extract

Read each recipe into the JSON shape in `references/extraction-rules.md` and save it to a working file, e.g. `/tmp/brewbook/recipe-1.json`. Set `"review": true` for anything read from a photo, and fill `uncertain` honestly: it becomes the "Check before brewing" box the user sees in the app.

### 2b. Add brew history

If the sheet itself records a brew day (measured gravities, dates), add it to `brews`. Only use brews from the sheets the user sends; don't pull in other logs.

### 3. Sanity-check

```bash
python3 scripts/build_page.py check /tmp/brewbook/recipe-1.json
```

This calculates OG, IBU and EBC from the ingredients and compares them with what the recipe states. Treat a flag as a prompt to look again at the photo: a gap usually means a misread amount, a wrong timing convention or a missing ingredient. Fix genuine misreads; for anything you can't resolve, add a plain-language line to `uncertain` (the implied-efficiency flag always goes there).

### 4. Check for duplicates

Search Notion for the recipe name, restricted to the Brew book data source. If a recipe with the same or a very similar name exists, ask whether to update it or add this as a separate recipe before writing anything. A photo of a sheet that's already in Brew book is a duplicate: don't add it again, but do add any new brew history or details it carries to the existing page.

### 5. Write the story and method details

Photos are not stored: the user reads recipes from the text, story and method, not the scans.

- `story`: 2–4 sentences in your own words: where the recipe comes from, what the beer is like, anything notable about how it was brewed or turned out. For book recipes, paraphrase the intro; never copy it. For the user's own sheets, use what the sheet shows (where it's from, how it was brewed and how it came out).
- `water`: strike litres and °C, sparge litres and °C, pre-boil litres. Leave unknowns null; the app calculates a strike temperature from the litres and grain when the temperature is missing.
- `when` on every sugar or extract ("Start of the boil", "15 min left in the boil", "Flameout") so it lands on the boil timer.
- `ferment`: give every recipe at least one step with a temperature and days. If the source has none, use the yeast's typical temperature, take days from the user's brew dates where possible, and say so in `stepNotes.ferment`.
- `stepNotes`: short tips per stage (prep, mash, sparge, boil, chill, ferment, package) for anything the generated method wouldn't say: rehydrating yeast, no finings, oxygenation, free-rise fermentation, ageing. Don't repeat what the method already says.
- `notes`: only what isn't covered elsewhere: brew results, variations, competition class.

The Method itself is generated from the data by `build_page.py` (and identically by the app), so the steps, amounts and timers always match the recipe.

### 6. Build and save

```bash
python3 scripts/build_page.py build /tmp/brewbook/recipe-1.json > /tmp/brewbook/payload-1.json
```

Then call Notion create-pages with parent `{"type": "data_source_id", "data_source_id": "<the Brew book data source ID>"}`, one page with the payload's `properties`, `content` and `icon`, and `allow_async: false` so the page URL comes back. Never write page content by hand; the app depends on the builder's exact output.

### 7. Report back

Keep it short. For each recipe: a link to the Notion page, the headline numbers (batch, OG, ABV, IBU), and the items the user should check, in plain language. Skip anything that went routinely. Then ask whether anything needs correcting.

## Corrections and marking a recipe Ready

When the user logs a brew ("brewed the Dubbel today, OG 1.064"), append it to `brews` the same way and update the page.

When the user corrects something ("the Saaz is 30 g", "efficiency is 75%") or confirms it's right, update the page as described in `references/notion-format.md`: fetch, extract the app data, change it, rebuild, then update properties and replace content. When they confirm the recipe is right, set `review` to false (rebuild with `--ready`) and clear any `uncertain` items they have resolved, so the warning box disappears.

## Style of the reply

Brief and factual, metric throughout, in the user's own language and spelling. Don't restate the whole recipe; the Notion page is the record.
