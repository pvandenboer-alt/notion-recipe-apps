# Brew book in Notion: the contract

The Brew book Android app reads these pages directly, so the shape matters. `scripts/build_page.py` produces it; don't hand-write page content.

## Finding the database

Search Notion for "Brew book", fetch the database, and take the data source ID from the `collection://` URL in its `<data-source>` tag. Create pages with parent `{"type": "data_source_id", "data_source_id": "<that ID>"}`. The app recognises the database by its Batch (L), OG and Times brewed columns, so keep those names.

## Creating the database

Only when the user has none and agrees. Ask which page it should live under, then create a database called "Brew book" (icon 🍺) with the properties below: Status has the options `To review` and `Ready`, and Tags has the fixed list in extraction-rules.md. Then remind the user to connect the Brew book app's integration to it (••• → Connections).

## Properties (written by the builder)

| Property | Type | Notes |
|---|---|---|
| Name | title | |
| Status | select | `To review` or `Ready` only |
| Style, Source | text | |
| Batch (L), Boil (min), Efficiency (%), OG, FG, ABV (%), IBU, EBC | number | `null` clears |
| Malts, Hops, Yeast | text | comma-joined names, for filtering in Notion |
| Tags | multi-select | fixed list in extraction-rules.md; anything else is rejected |
| Last brewed | date | latest `brews` date (the builder writes `date:Last brewed:start`) |
| Times brewed | number | count of `brews` |
| Updated | last edited time | automatic |

## Page body

Sections in this order, each only if it has content: At a glance, Check before brewing callout (while To review) or Assumptions, Story, Ingredients (Fermentables, Hops, Yeast, Other), Method (numbered steps generated from the data), Brew history, Notes, Transcription (toggle), then a divider and the **App data** toggle.

The App data toggle holds a fenced `json` code block with the full recipe (`"v": 1` plus every field from extraction-rules.md). The app parses only this block for recipe details; the readable sections are for people browsing Notion. That's why edits must go through the builder: changing the readable tables by hand doesn't change what the app shows.

Photos are not stored on recipe pages.

## Updating an existing recipe

1. Fetch the page. Save the fetched text to a file and run `build_page.py extract page.txt` to get the current app data and the existing photo sources.
2. Apply the change to that JSON. Keep `createdAt`; set `updatedAt` to now (ms since epoch).
3. Rebuild with `build_page.py build`.
4. update-page `update_properties` with the new properties, then update-page `replace_content` with the new content.

## Deleting

Only when the user asks for a specific recipe. Move it to Notion trash with delete-pages; it can be restored from Notion's trash.
