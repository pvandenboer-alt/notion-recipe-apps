# Reading a recipe into Brew book JSON

Fill this shape. Every field is required; use `null`, `""` or `[]` when the source doesn't say.

```json
{
  "name": "string",
  "style": "string",
  "source": "string",
  "tags": ["string"],
  "batchL": 20, "boilMin": 60, "efficiency": 70,
  "og": 1.056, "fg": 1.008, "abv": 6.5, "ibu": 22, "ebc": 8,
  "fermentables": [{"name": "Pale malt, Belgian", "kg": 4, "ebc": 6, "ppg": 37, "type": "grain", "when": "for sugars and extracts: Start of the boil / 15 min left in the boil / Flameout"}],
  "hops": [{"name": "Saaz", "g": 20, "aa": 4, "use": "boil", "time": 30}],
  "yeast": [{"name": "Westmalle (WLP530 / Wyeast 3787)", "amount": "1 pack", "atten": 78}],
  "mash": [{"name": "Mash", "tempC": 65, "min": 60}],
  "ferment": [{"name": "Primary", "tempC": 18, "days": 3}],
  "other": [{"name": "Irish moss tablet", "amount": "1", "when": "15 min left in the boil"}],
  "notes": "string",
  "transcript": "string",
  "story": "string, 2–4 sentences in your own words",
  "water": {"strikeL": 24, "strikeC": 69, "spargeL": 4, "spargeC": 75, "preboilL": 23},
  "stepNotes": {"prep": "", "mash": "", "sparge": "", "boil": "", "chill": "", "ferment": "", "package": ""},
  "brews": [{"date": "2021-05-11", "litres": 18, "og": 1.068, "fg": 1.015, "abv": 7.5, "notes": "string"}],
  "uncertain": ["string"],
  "review": true
}
```

Allowed values: fermentable `type` is `grain`, `adjunct`, `extract` or `sugar`. Hop `use` is `boil`, `fwh`, `whirlpool`, `dryhop` or `mash`.

## Units and numbers

- Everything metric: kg and g, litres, °C. 1 lb = 0.4536 kg, 1 oz = 28.35 g, 1 US gal = 3.785 L, 1 UK gal = 4.546 L. Convert °F to °C. "20 l/qt" style dual units are litres.
- Read decimal commas as decimals (9,4 = 9.4).
- Gravities as 1.xxx. "1069" means 1.069. Convert Plato with SG = 1 + P / (258.6 − (P / 258.2 × 227.1)); 12 °P ≈ 1.048.
- A range (OG 1.054–1.058) becomes its midpoint; keep the full range in `notes` and say so in `uncertain`.
- When the sheet gives no efficiency but does give a calculated OG, set `efficiency` to the value that OG implies (`build_page.py check` reports it) and note that in `uncertain`, so scaling uses the recipe's own design efficiency.
- Store what the recipe states as targets. Brew-log measurements (actual OG/FG on a brew day) go in `notes`, not the target fields, unless the sheet has no target at all.

## Ingredients

- Names in English, with a non-English original in brackets, so searches work in both languages: "Pilsner malt (Pilsmout)", "Brown candi sugar (Bruine kandijsuiker)", "Coriander (Koriander)".
- Colour in EBC. EBC = SRM × 1.97; Lovibond ≈ SRM. Weyermann-style names such as "Cara 120" often carry the EBC in the name.
- Fill typical values when the source doesn't give them, and list each one in `uncertain`:
  - extract potential (`ppg`): base malt ~37, wheat ~38, crystal/caramel ~34, roasted/chocolate ~28, Special B ~30, DME 44, LME 36, table sugar or rock candi 46, candi syrup 32
  - hop alpha acid % for the variety
  - yeast apparent attenuation % for the strain
  - malt colour for the malt type
- Sugars and syrups go in `fermentables` with type `sugar`. "Dark candi sugar" in modern recipes usually means candi syrup; check whether the stated colour and OG only work with syrup and say which you chose.
- Spices, finings, tablets, salts and priming sugar go in `other`, with `when` written as "10 min left in the boil", "Mash", "Bottling" and so on. The app turns "N min left in the boil" into a timed alarm, so use that exact phrasing for anything added during the boil.
- Never invent an ingredient. If something is illegible, record what you can and flag it.

## Timing

- Hop `time` is minutes LEFT in the boil for `boil` and `whirlpool`, and days for `dryhop`. First wort hops are `fwh` with `time: null`.
- Dutch brew sheets (and some others) count minutes AFTER the boil starts. The column is often headed "Na min. koken". Convert: minutes left = boil time − the number. Example: 90 min boil, Northern Brewer at "5" → `time: 85`.
- A "Kooktijd" column next to a hop usually means that hop's boil time, which already is minutes left.
- If you can't tell which convention a sheet uses, pick the likelier one and state it in `uncertain`. This is the single most common misread.
- Mash: one entry per rest with temperature and minutes, including mash out.

## Dutch brew sheet vocabulary

| Dutch | Meaning |
|---|---|
| Recept / Biersoort | Recipe name / beer style |
| Liters | Batch size |
| Berekend (begin/eind) SG | Calculated (original/final) gravity |
| Maischwater | Mash water (litres) |
| Storting | Grain bill |
| Gewicht | Weight (grams) |
| Maischschema / Rusttijd | Mash schedule / rest time (min) |
| Spoelen / Hevelen | Sparge / transfer |
| Koken / Kooktijd | Boil / boil time |
| Hop en additieven / Na min. koken | Hops and additions / minutes after boil start |
| Koelen | Chilling |
| Gist / Vloeibaar | Yeast / liquid |
| Hoofdgisting / Nagisting | Primary / secondary fermentation |
| Vergisting | Attenuation |
| Bottelen / Suikeroplossing | Bottling / priming sugar solution |
| Herberekeningsfactor | Recalculation (scaling) factor |
| Beslagdikte | Mash thickness |
| Kandijsuiker | Candi sugar |
| Zeewier (helderheid) | Seaweed tablet, i.e. Irish moss (for clarity) |

## Text fields

- `name`: the recipe's own title. For a sheet with only a style and a course name, combine them: "Sterke Blonde (Brewing course)".
- `source`: book or site title plus page, or the course/sheet. "Book title, p. 185", "Club recipe sheet".
- `tags`: pick from this fixed list only (the app filters on it and Notion rejects anything else):
  - Origin: Belgian, Dutch, German, British, American
  - Colour: Pale, Amber, Dark
  - Strength: Session (under 5% ABV), Strong (7.5% ABV and over)
  - Character: Hoppy, Malty, Roasty, Spiced, Wheat, Smoked, Sour
  - Recipe: Clone (copy of a commercial beer), Competition (made for or placed in a competition), Course
  Use origin for the style's home (a Russian Imperial Stout is British; La Trappe is Dutch). Add Spiced for coriander, orange peel and similar.
- `notes`: method details in your own words (strike and sparge volumes and temperatures, pre-boil volume, when sugar goes in, fermentation approach, priming) plus any brew-log data (date, measured gravities, volumes, bottle count).
- `transcript`: for handwritten notes and filled-in brew sheets, a faithful plain-text transcription in the original language and units. For printed books, magazines and websites, use `""` and don't copy their prose; the recipe facts and your own summary in `notes` are enough.
- `uncertain`: short, specific notes on anything illegible, ambiguous, converted or assumed. These show as a "Check before brewing" box until the recipe is marked Ready.
- `brews`: one entry per time the recipe was actually brewed, from the sheet's brew-day measurements. `date` as YYYY-MM-DD; `litres` into the fermenter; measured `og` and `fg`; measured `abv`; short `notes` (attenuation, drinkable-from date, bottle count). Leave `[]` when there's no brewing record.
- `review`: `true` for anything read from a photo. Set `false` only when the user has confirmed the recipe is correct.

## Worked example: Dutch brew sheet

Sheet says: Liters 19, Berekend SG 1069, Koken 90 min, and under "Hop en additieven / Na min. koken": `5 | 24 | Northern Brewer 9,4%`, `45 | 1 | Tablet zeewier`, `75 | 340 | Suiker`, `80 | 6 | Koriander`.

Becomes:

```json
"batchL": 19, "boilMin": 90, "og": 1.069,
"hops": [{"name": "Northern Brewer", "g": 24, "aa": 9.4, "use": "boil", "time": 85}],
"fermentables": [{"name": "Sugar (Suiker)", "kg": 0.34, "ebc": 0, "ppg": 46, "type": "sugar"}],
"other": [
  {"name": "Seaweed / Irish moss tablet (Zeewier), for clarity", "amount": "1", "when": "45 min left in the boil"},
  {"name": "Coriander (Koriander)", "amount": "6 g", "when": "10 min left in the boil"}
],
"notes": "Add the sugar with 15 min left in the boil.",
"uncertain": ["The sheet gives additions as minutes after the boil starts (\"Na min. koken\"); converted to minutes left in a 90 min boil"]
```
