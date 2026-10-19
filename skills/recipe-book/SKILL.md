---
name: "recipe-book"
description: "Adds cooking and baking recipes to the user's Recipe book database in Notion, logs when they cook them, and corrects or updates recipes already there. Use whenever the user shares a recipe link, a photo or scan of a cookbook page or handwritten recipe, a screenshot, or pasted recipe text, or asks to save, add, import, clip, log, rate, fix or update a recipe, dish or meal in Recipe book, their recipes or Notion, even if they don't name the skill. Not for beer recipes (those go to Brew book). Extracts the recipe, converts it to metric, writes the method in its own words and saves it in the exact format the Recipe book app reads."
---

# Recipe book

The user keeps their cooking and baking recipes in a Notion database called Recipe book. The Recipe book Android app reads it, so every page needs the same structure, including a JSON "App data" block. This skill turns whatever they hand you into that structure and saves it.

Read `references/extraction-rules.md` before extracting anything: it has the JSON shape, the fixed option lists, where useful information hides on recipe pages, and the unit rules. Read `references/notion-format.md` when updating or deleting a recipe, or before the first save in a conversation, to find the database.

## Find the database first

Search Notion for "Recipe book" and fetch the database. Take the data source ID from its `collection://` URL and use it for the rest of the conversation. If there is more than one, ask which to use. If there is none, offer to create it with the schema in `references/notion-format.md` (the Recipe book app can also create it during its setup).

## Set up the builder

The bundled `scripts/build_page.py` only keeps `https://` image URLs, so it silently drops photos uploaded to Notion (`file-upload://` and `notion-file-block://`). Before any build or check, make a patched working copy and use that copy for every command below:

```bash
mkdir -p /tmp/recipes && cp scripts/build_page.py /tmp/recipes/build_page.py && sed -i 's|startswith("https://")|startswith(("https://", "file-upload://", "notion-file-block://"))|g' /tmp/recipes/build_page.py
```

Always use the patched copy, including for rebuilds when logging cooks or making corrections. The original would wipe uploaded photos from any page it rebuilds.

## Adding recipes

### 1. Work out what you've been given

- A link: fetch the page with `html_extraction_method: "markdown"` so image URLs come through. Some sites can't be fetched (some block automated access or sit behind a captcha). Don't substitute another site's version of the dish, and don't try to fetch a blocked site's images some other way. Process the rest of the batch, then ask once for all the blocked ones together, as a print-to-PDF (preferred: it carries the photos), screenshot or pasted recipe of each page.
- Photos: work out which photos belong to the same recipe; ask once if it's genuinely unclear.
- Typed or pasted text: extract from it directly.
- Files they mention but didn't attach: when the session can reach their computer, look for them (usually Documents, Downloads or Desktop) before asking, and stage only the files you need.

Several recipes at once is normal; handle them one after another and report them together.

### 2. Check for duplicates

Search Notion for the recipe name, restricted to the Recipe book data source. If the same or a very similar recipe exists, ask whether to update it or add this as a separate recipe before writing anything.

### 3. Extract

Fill the JSON shape and save it to a working file, e.g. `/tmp/recipes/recipe-1.json`. The things that most often go wrong:

- **Missing ingredients.** Read the method and check that everything it uses is in the ingredient list (oil, garlic, salt, water are the usual gaps). Add what's missing and say so in `uncertain`.
- **Notes hold the good stuff.** Substitutions, dietary versions and storage advice are often in notes or FAQs outside the recipe card; capture them in `tips` and `storage`.
- **Own words.** Write `about`, `steps` and `tips` yourself. Keep every amount, time, temperature and visual cue, but not the author's sentences.
- **All the recipe's photos (web pages).** Collect every photo that belongs to the recipe into `images`: step photos with the number of the step they illustrate, finished-dish shots with `step: null`. Use the page's own image URLs at full size; skip logos, author avatars, ads, book promos and thumbnails of other recipes. The builder embeds step photos under their step and the rest in a Photos gallery, and drops duplicates of the cover. Only set `noImages: true` when the page truly has no photos beyond the cover.
- **Honest `uncertain`.** Conversions, estimated times, unstated amounts and unclear oven types all go there; it becomes the "Check before cooking" box. Don't put photo problems there; that box is for cooking.

#### Photos from PDFs and screenshots

When the recipe comes as a PDF or screenshot, its photos are in the file, not at a URL.

1. **Extract.** `pdfimages -list file.pdf` to see what's there, then `pdfimages -all file.pdf out/img`. Make a contact sheet (PIL thumbnails with filenames) and look at it, so you pick by eye rather than by size.
2. **Pick.** Keep the hero shot and any process shots of this recipe. Skip site logos, author headshots, ads, and grids of other recipes' thumbnails. Convert PNGs to JPG.
3. **Upload.** For each photo, call Notion `create-file-upload` with a descriptive filename (`guacamole-mashing.jpg`). POST the file to the returned `upload_url` with curl, using form field `file` plus the returned `authorization` header. Do it promptly, because the upload URL expires after about an hour. The response's `markdown_source` (`file-upload://<id>`) is the image URL.
4. **Fill `images`.** Make the hero shot the first entry with `step: null`, and give process shots their step number. Leave `cover` as `""`: Notion only accepts external URLs as page covers, so an uploaded photo can't be the cover, and the hero shot goes in the Photos section instead. The `check` flag "No cover image" is expected for these recipes; ignore it.
5. **If the upload fails** because the sandbox can't reach api.notion.com, finish the pages without photos. Give the user the extracted photos as one zip with files named after each recipe, and mention once that allowing `api.notion.com` in their network settings lets this happen automatically.

### 4. Check

```bash
python3 /tmp/recipes/build_page.py check /tmp/recipes/recipe-1.json
```

It reports options Notion would reject, cups/oz/°F left in the text, ingredients without amounts, missing times and fields, and a missing cover or photos. Fix what you can; anything genuinely unknown goes in `uncertain`.

### 5. Build and save

```bash
python3 /tmp/recipes/build_page.py build /tmp/recipes/recipe-1.json > /tmp/recipes/payload-1.json
```

Call Notion create-pages with parent `{"type": "data_source_id", "data_source_id": "<the Recipe book data source ID>"}`, one page per recipe with the payload's `properties`, `content`, `icon` and `cover` (omit `cover` when it is null), and `allow_async: false` so the page URLs come back. Two or three recipes per call is fine. Never write page content by hand: copy the payload exactly, including the App data JSON, and if a long payload gets mangled, fix it with update-page `update_content` rather than recreating the page.

### 6. Swap uploaded photo links for stable ones

A `file-upload://` link works once. After the page is created, Notion turns each uploaded image into a `notion-file-block://...` source, but the App data JSON still holds the one-off link. For every page that has uploaded photos:

1. Fetch the page. Each image in the body now shows as `![caption](notion-file-block://...)`.
2. Use update-page `update_content` to replace each `file-upload://<id>` in the App data JSON with the matching `notion-file-block://...` URL, copied exactly from the fetch, matched by caption or filename.

This also confirms the photos landed. Skip it for recipes whose images are all `https://` links.

### 7. Report back

Brief: a link to each page, how many photos each got, and the items the user should check, in plain language. List any links that couldn't be fetched and what's needed for them. Don't restate the recipe; the page is the record.

### Adding options

If a recipe genuinely needs a cuisine, main ingredient, tag or equipment option that doesn't exist, add it rather than dropping it: update the database with `notion-update-data-source` (`ALTER COLUMN ... SET MULTI_SELECT(...)` listing every existing option plus the new one), add it to the matching list at the top of `scripts/build_page.py` and in `references/extraction-rules.md`, and mention it in the report.

## Adding photos to a recipe that's already saved

1. Find the pages that need them: query the data source and fetch the candidates. Pages missing photos have `"images":[]` in their App data, and often a "No photos" line in Check before cooking.
2. Get the source: re-fetch the link for sites that work, or find the original PDFs or screenshots. For PDFs, extract, pick and upload as above.
3. Either rebuild and replace the page as described in `references/notion-format.md` (with the patched builder), or make targeted edits with update-page `update_content`. The targeted route is quicker for photo-only changes:
   - Insert `## Photos` plus the hero image line directly before `## Ingredients`.
   - Add each step photo as a tab-indented image line straight after its step's line. Match on the step's `N. **Title.**` prefix, because the step text also appears in the JSON.
   - Remove the "No photos" line from the callout and from the JSON `uncertain` array.
   - Fetch the page, then replace `"images":[]` in the JSON with the entries, using the `notion-file-block://` URLs. Match on `"images":[]}` alone, because long JSON is split across lines and longer matches can straddle a break.

## Logging a cook, rating, corrections

- "Made the fried rice tonight, bit salty, 4 stars": add an entry to `cooks` (date, servings if given, rating, notes) and set `rating` if they give one. Rebuild with the patched builder and update the page as in `references/notion-format.md`.
- Corrections ("it's 300 g mince", "use 200°C fan") change the JSON, then rebuild and update.
- When they say the recipe works or is right, rebuild with `--ready` and remove the `uncertain` items they have resolved, so the warning box disappears. A cook logged without complaints is a good moment to ask once whether to mark it Ready.
- Before any rebuild, check that the extracted JSON's `images` match the photos on the page. If an older page has photos in the body but not in the JSON, add them first so `replace_content` doesn't delete them.

## Style of the reply

Brief and factual, metric, in the user's own language and spelling. No summary sections.
