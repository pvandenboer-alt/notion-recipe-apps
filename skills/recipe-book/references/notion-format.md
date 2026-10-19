# Recipe book in Notion: the contract

`scripts/build_page.py` produces every page; don't hand-write page content. The Recipe book app reads the JSON in the App data toggle, so the readable page and the JSON must always come from the same build.

## Finding the database

Search Notion for "Recipe book", fetch the database, and take the data source ID from the `collection://` URL in its `<data-source>` tag. Create pages with parent `{"type": "data_source_id", "data_source_id": "<that ID>"}`. The app recognises the database by its Course, Servings and Times cooked columns, so keep those names.

## Creating the database

Only when the user has none and agrees. Ask which page it should live under, then create a database called "Recipe book" (icon 📖) with the properties below. The option lists for Course, Cuisine, Main ingredient, Tags and Equipment are the fixed lists in extraction-rules.md; Status has `To review` and `Ready`; Language has `English` and `Dutch`; Rating has `★`, `★★`, `★★★`, `★★★★` and `★★★★★`. Then remind the user to connect the Recipe book app's integration to it (••• → Connections).

## Properties (written by the builder)

| Property | Type | From |
|---|---|---|
| Name | title | `name` |
| Status | select | `To review` while `review` is true, else `Ready` |
| Course | select | `course` |
| Cuisine, Main ingredient, Tags, Equipment | multi-select | fixed lists in extraction-rules.md |
| Servings | number | `servings` |
| Yield | text | `yield` |
| Prep (min), Cook (min), Total (min) | number | times |
| Key ingredients | text | `keyIngredients`, comma-joined |
| Source | text | "source (author)" |
| Link | url | `link` |
| Language | select | English or Dutch |
| Rating | select | ★ to ★★★★★ from the user's `rating` |
| Last cooked | date | latest `cooks` date |
| Times cooked | number | count of `cooks` |
| Updated | last edited time | automatic |

The payload also has `icon` (emoji) and `cover` (image URL); `images` lives in the JSON and is rendered into the body. Pass both to create-pages; on updates, set them with update-page only if they changed.

## Page body

In this order, each only if it has content: At a glance, Check before cooking callout (while To review) or Assumptions (once Ready), About, Photos (gallery images, two per row in columns), Ingredients (### per group when there's more than one), Method (step photos nested under their step), Tips and variations, Storage and reheating, Serve with, Notes, Cook log, Transcription (toggle), then a divider and the **App data** toggle with the full JSON (`"v": 1`).

## Updating an existing recipe

1. Fetch the page. Save the fetched text to a file and run `build_page.py extract page.txt` to get the current JSON.
2. Change the JSON. Keep `createdAt`; set `updatedAt` to now (ms since epoch).
3. Rebuild with `build_page.py build`.
4. update-page `update_properties` with the new properties (property values of `null` clear a field), then update-page `replace_content` with the new content.

To add photos to an older recipe, extract its JSON, fill `images` from the source page, rebuild and replace the content.

Pages made before the App data block existed have no JSON: rebuild the JSON from the readable page, then follow the same steps.

## Deleting

Only when the user asks for a specific recipe. Move it to Notion trash; it can be restored from there.
