# Reading a recipe into Recipe book JSON

Fill this shape. Every key should be present; use `null`, `""` or `[]` when the source doesn't say.

```jsonc
{
  "name": "Egg fried rice",
  "source": "RecipeTin Eats",            // site, book (with page) or person
  "author": "Nagi Maehashi",
  "link": "https://...",                 // "" for books and photos
  "language": "English",                 // language of the source: English or Dutch
  "course": "Side",
  "cuisine": ["Chinese"],
  "mainIngredients": ["Rice", "Eggs"],
  "tags": ["Quick", "Weeknight"],
  "equipment": ["Wok"],
  "equipmentNote": "Wok, or a large frying pan",   // optional free text for the page
  "servings": 3,                          // number, for scaling later
  "yield": "2–3 people as a meal",        // as the source says it: "20 rolls", "1 loaf", "2 people"
  "prepMin": 5, "cookMin": 10, "totalMin": 15,
  "timeNote": "",                         // e.g. "includes 30 min rest and 60 min proof"
  "kcal": 520,                            // per serving, only if the source gives it
  "glance": [],                           // extra one-liners for At a glance
  "about": "2–3 sentences in your own words",
  "keyIngredients": ["Day-old rice", "eggs", "bacon"],
  "ingredients": [
    {"group": "Sauce", "items": [
      {"qty": 1, "qtyMax": null, "unit": "tbsp", "item": "oyster sauce", "note": "", "optional": false}
    ]}
  ],
  "steps": [{"title": "Heat the wok", "text": "Heat 1½ tbsp oil over high heat until smoking.", "timerMin": null}],
  "tips": [{"label": "No alcohol", "text": "..."}],
  "storage": ["Keeps 2–3 days in an airtight container."],
  "serveWith": "",
  "notes": "",
  "transcript": "",
  "uncertain": ["..."],
  "cooks": [{"date": "2026-10-20", "servings": 4, "rating": 4, "notes": "a bit salty"}],
  "rating": null,                         // the user's own 1–5, never the website's rating
  "cover": "https://...jpg",              // the recipe's main photo (og:image), or ""
  "images": [                             // every other photo of this recipe on the page
    {"url": "https://...jpg", "caption": "Folding in the flour", "step": 3},   // step photo
    {"url": "https://...jpg", "caption": "Sliced", "step": null}              // gallery photo
  ],
  "noImages": false,                      // true only if the page has no photos beyond the cover
  "icon": "🍳",                           // one emoji that fits the dish; "" picks one from the course
  "review": true
}
```

## Fixed lists

Notion rejects anything else; `build_page.py check` reports what it dropped. If something genuinely doesn't fit, leave it out and tell the user, who can add an option to the database (and the lists at the top of the script).

- course (one): Main, Side, Starter, Soup, Salad, Breakfast, Lunch, Snack, Baking, Dessert, Sauce, Drink
- cuisine: Chinese, Asian, Dutch, American, Italian, French, Indian, Mexican, Japanese, Thai, Middle Eastern, Australian, German
- mainIngredients: Beef, Pork, Chicken, Lamb, Fish, Seafood, Eggs, Vegetables, Mushrooms, Rice, Pasta, Bread & dough, Chocolate
- tags: Quick (30 min or less in total), Weeknight, Make-ahead, Freezer-friendly, Party, Kids, Vegetarian, Gluten-free option, Spicy, Comfort food, Outdoor, Festive (Sinterklaas, Christmas and other holiday food)
- equipment: Wok, Oven, Pizza oven, BBQ, Cast iron pan, Air fryer, Slow cooker, Stand mixer, Food processor, Waffle iron (stroopwafel/pizzelle irons too) (only what the recipe needs, not every pan)
- unit: g, kg, ml, l, tsp, tbsp, pinch, or "" for counted items (2 eggs, ½ onion)

## Where to find things on a web page

1. **The recipe card.** Most recipe sites (WordPress Recipe Maker, Tasty Recipes) print a card with servings, times, grouped ingredients and steps, and embed the same data as schema.org Recipe. Use the card; skip the story, ads and comments.
2. **Notes under the card.** Numbered notes often hold the important bits: substitutions, dietary options, why an ingredient matters, scaling advice. Put these in `tips`.
3. **FAQ or tips sections above the card.** Storage, freezing and reheating advice often lives here. Put it in `storage`.
4. **Pages without a card** (brand blogs such as Gozney, magazine sites): read the ingredient list and steps, then cross-check them. Ingredients that appear only in the steps (oil, garlic, salt) are common; add them to `ingredients` and say so in `uncertain`.
5. **Metric/imperial toggles:** take the metric version.
6. **Photos.** `cover` is the page's main image (og:image). Then go through every image in the article and recipe card and put the recipe's own photos in `images`, at full size, in page order:
   - Step photos (process shots next to a step, or video thumbnails under a step) get that step's number in your `steps`, which may differ from the source's numbering once steps are merged or split.
   - Finished-dish, serving and ingredient shots get `step: null`; they appear in a Photos gallery after About.
   - Full size: WordPress drop `-300x300`/`-1024x683` suffixes when a larger version is linked; Shopify (Gozney) replace `_small` with nothing and add `&width=1000`; Blogger use `/s1600/` instead of `/s400/`; unescape `&amp;` to `&`.
   - Skip logos, author avatars, star-rating icons, ads, book or product promos, Instagram feeds and other recipes' thumbnails.
   - Don't download or re-upload anything; Notion links the external URLs.
7. Ignore star ratings and comment counts; reader comments are hearsay unless the user asks for a reader tip.

For **cookbook photos and screenshots**, the user's own photos can't be linked, so leave `images` empty and set `noImages: true`; read the whole page, check for a continuation on the next photo, and set `source` to "Book title, p. 123". For **handwritten or family recipes**, also fill `transcript` with a faithful transcription in the original language.

## Units

- Metric throughout. Convert oz (28.35 g), lb (454 g), fl oz (30 ml), °F → °C (round to the nearest 5 °C). Never leave cups, oz or °F in ingredients or steps; `check` flags them.
- Cups: 1 metric/Australian cup = 250 ml, 1 US cup = 240 ml. Liquids convert straight to ml. For solids use a weight and list the conversion in `uncertain` so the user weighs it the first time. Typical weights per 250 ml cup: plain flour 150 g, white sugar 220 g, brown sugar (packed) 200 g, butter 230 g, rolled oats 90 g, uncooked white rice 200 g, cooked rice (packed) 200 g, grated cheese 100 g, frozen peas or mixed veg 150 g, chopped nuts 130 g, cocoa 100 g, breadcrumbs 110 g.
- Spoons stay as tsp and tbsp. An Australian tablespoon is 20 ml; most other countries use 15 ml. When a recipe's tablespoon differs from the user's and it uses tablespoons for something precise (baking powder, bicarb, salt in baking, gelatine, yeast), add the ml to the note ("1 tbsp (15 ml)") and flag it in `uncertain`. For sauces and oil in savoury cooking, leave it.
- Butter "sticks" (US) are 113 g. Eggs are large (about 60 g) unless the recipe says otherwise.
- Counted items keep the count with the noun in `item`: `{"qty": 2, "unit": "", "item": "garlic cloves", "note": "minced"}`. Use `qty` 0.5 / 0.25 / 0.75 for halves and quarters.
- No quantity at all ("salt and pepper", "a splash of olive oil", "pinch of salt"): `qty: null` and put the whole phrase in `item`, or use unit `pinch`.
- Ranges: `qty` low, `qtyMax` high.
- Ovens: note whether a temperature is conventional or fan-forced. Dutch "boven- en onderwarmte" means conventional; "hetelucht" means fan. Give the other version in `uncertain` (fan ≈ conventional − 20 °C).

## Language

- Write everything in the user's language and spelling (English unless they say otherwise). For sources in another language, translate, and put the original term in brackets where it helps shopping or searching: "plain flour (bloem)", "pork and beef mince, 50/50 (half-om-half gehakt)". Translate group names the same way: "Dough (deeg)".
- Keep a dish's own name when it's a proper name ("Brabantse worstenbroodjes", "Pad see ew"); otherwise use the English name.
- Dutch kitchen words: bloem = plain flour, zelfrijzend bakmeel = self-raising flour, roomboter = butter, gist = yeast, paneermeel = dried breadcrumbs, gehakt = mince, half-om-half = 50/50 pork and beef, slagroom = thickened/whipping cream, kwark = quark, eetlepel (el) = tbsp, theelepel (tl) = tsp, snufje = pinch, deeg = dough, vulling = filling, rijzen = rise/proof, kneden = knead, bakken = bake/fry, voorverwarmen = preheat.

## Writing the text fields

Never copy the author's sentences. Recipe facts (ingredients, amounts, times, temperatures) are fine to record; the words around them must be yours.

- `about`: 2–3 sentences on what the dish is and what makes it work. No marketing, no "the best ever".
- `steps`: short title (2–4 words) plus the instruction in your own words, keeping every time, temperature and visual cue that matters ("until the bacon is lightly golden"). Split long steps; merge trivial ones. Put timed waits in `timerMin` (the future app turns them into timers). Include oven preheating in the step where it should start.
- `tips`: one idea per item with a 1–3 word label: substitutions, dietary versions, equipment alternatives, scaling, what not to do and why.
- `uncertain`: everything converted, estimated, missing or ambiguous, in plain language. Missing times, unstated amounts, ingredients added from the method, unclear oven type, cup conversions. This becomes the "Check before cooking" box.
- `keyIngredients`: the 5–8 ingredients someone would search by; skip salt, pepper, oil and water.
- `prepMin`/`cookMin`/`totalMin`: from the source. If it gives none, estimate, set them, and say so in `uncertain`. `totalMin` includes resting, proofing and marinating.
- `review`: always `true` for a new recipe. Only the user sets it to false, after they have cooked it or confirmed it's right.
