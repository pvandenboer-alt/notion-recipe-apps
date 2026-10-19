#!/usr/bin/env python3
"""Recipe book page builder.

Turns a recipe JSON file into the Notion payload for a Recipe book database,
checks it for gaps, and pulls the app data back out of a fetched page.

Usage:
  build_page.py build   recipe.json [--review|--ready] > payload.json
  build_page.py check   recipe.json          # missing fields, non-metric units, dropped tags
  build_page.py extract fetched_page.txt     # prints {"data": {...}}

payload.json = {"properties": {...}, "content": "...", "icon": "🍳", "cover": "https://..." | null}
Images: `cover` becomes the page cover; `images` (step photos and other recipe photos) are embedded in the
page body: step photos nested under their method step, the rest in a Photos section after About.
Pass these straight to Notion create-pages (or update-page: update_properties +
replace_content, and update cover/icon if they changed).
"""
import html, json, math, re, sys

COURSES = ["Main", "Side", "Starter", "Soup", "Salad", "Breakfast", "Lunch", "Snack", "Baking", "Dessert", "Sauce", "Drink"]
CUISINES = ["Chinese", "Asian", "Dutch", "American", "Italian", "French", "Indian", "Mexican", "Japanese", "Thai",
            "Middle Eastern", "Australian", "German"]
MAINS = ["Beef", "Pork", "Chicken", "Lamb", "Fish", "Seafood", "Eggs", "Vegetables", "Mushrooms", "Rice", "Pasta",
         "Bread & dough", "Chocolate"]
TAGS = ["Quick", "Weeknight", "Make-ahead", "Freezer-friendly", "Party", "Kids", "Vegetarian", "Gluten-free option",
        "Spicy", "Comfort food", "Outdoor", "Festive"]
EQUIPMENT = ["Wok", "Oven", "Pizza oven", "BBQ", "Cast iron pan", "Air fryer", "Slow cooker", "Stand mixer", "Food processor",
             "Waffle iron"]
LANGUAGES = ["English", "Dutch"]
UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "pinch", ""]
ICONS = {"Main": "🍲", "Side": "🥗", "Starter": "🥟", "Soup": "🍜", "Salad": "🥗", "Breakfast": "🍳", "Lunch": "🥪",
         "Snack": "🥨", "Baking": "🥖", "Dessert": "🍰", "Sauce": "🫙", "Drink": "🍹"}
FRACTIONS = {0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔"}
NON_METRIC = re.compile(r"\b(cups?|oz|ounces?|lbs?|pounds?|°F|fahrenheit|quarts?|pints?|sticks? of butter)\b", re.I)


# ---------- helpers ----------
def num(v):
    if v is None or v == "":
        return None
    try:
        n = float(str(v).strip().replace(",", "."))
        return n if math.isfinite(n) else None
    except ValueError:
        return None


def esc(s):
    s = "" if s is None else str(s)
    s = re.sub(r"([\\*~`$\[\]<>{}|^])", r"\\\1", s)
    return re.sub(r"\n+", " ", s)


def pick(values, allowed):
    want = {str(v).strip().lower() for v in (values or []) if v}
    return [a for a in allowed if a.lower() in want]


def dropped(values, allowed):
    ok = {a.lower() for a in allowed}
    return [str(v) for v in (values or []) if v and str(v).strip().lower() not in ok]


def qty_txt(q, unit):
    """Grams and millilitres as plain numbers; spoons and counts as kitchen fractions (½, ¼)."""
    if q is None:
        return ""
    if unit in ("g", "ml", "kg", "l") or q >= 20:
        return f"{q:g}"
    whole, frac = int(q), round(q - int(q), 2)
    if frac == 0:
        return str(whole)
    sym = FRACTIONS.get(frac)
    if sym:
        return (str(whole) if whole else "") + sym
    return f"{q:g}"


def ing_line(i):
    q = qty_txt(i["qty"], i["unit"])
    if q and i["qtyMax"] is not None:
        q += "–" + qty_txt(i["qtyMax"], i["unit"])
    head = " ".join(x for x in (q, i["unit"]) if x)
    s = (head + " " if head else "") + i["item"]
    if not head and s:
        s = s[0].upper() + s[1:]
    if i["note"]:
        s += ", " + i["note"]
    if i["optional"]:
        s += " (optional)"
    return s


def clean_url(u):
    u = html.unescape(str(u or "")).strip()
    if u.startswith("//"):
        u = "https:" + u
    if u.startswith("http://"):
        u = "https://" + u[7:]
    return u.replace(" ", "%20").replace("(", "%28").replace(")", "%29")


def url_key(u):
    """Compare images ignoring query strings and Shopify/WordPress size suffixes."""
    u = re.sub(r"[?#].*$", "", clean_url(u)).lower()
    u = re.sub(r"-\d{2,4}x\d{2,4}(?=\.\w+$)", "", u)          # WordPress -1024x683
    u = re.sub(r"_\d{2,4}x\d{0,4}(?=\.\w+$)", "", u)          # Shopify _1000x1500
    return u


def norm_images(raw, cover, nsteps):
    seen, out = {url_key(cover)} if cover else set(), []
    for x in raw if isinstance(raw, list) else []:
        if isinstance(x, str):
            x = {"url": x}
        if not isinstance(x, dict):
            continue
        u = clean_url(x.get("url"))
        if not u.startswith("https://") or url_key(u) in seen:
            continue
        seen.add(url_key(u))
        st = num(x.get("step"))
        st = int(st) if st is not None and 1 <= st <= nsteps else None
        out.append({"url": u, "caption": str(x.get("caption") or "").strip(), "step": st})
    return out[:24]


# ---------- normalise ----------
def normalise(o):
    s = lambda v: "" if v is None else str(v)
    lst = lambda v: v if isinstance(v, list) else []
    groups = []
    for g in lst(o.get("ingredients")):
        if not isinstance(g, dict):
            continue
        items = []
        for x in lst(g.get("items")):
            if not isinstance(x, dict) or not s(x.get("item")).strip():
                continue
            unit = s(x.get("unit")).strip().lower()
            items.append({"qty": num(x.get("qty")), "qtyMax": num(x.get("qtyMax")), "unit": unit if unit in UNITS else "",
                          "item": s(x.get("item")).strip(), "note": s(x.get("note")).strip(),
                          "optional": bool(x.get("optional", False))})
        if items:
            groups.append({"group": s(g.get("group")).strip(), "items": items})
    r = {
        "name": s(o.get("name")).strip() or "Untitled recipe",
        "source": s(o.get("source")).strip(),
        "author": s(o.get("author")).strip(),
        "link": s(o.get("link")).strip(),
        "language": next(iter(pick([o.get("language")], LANGUAGES)), "English"),
        "course": next(iter(pick([o.get("course")], COURSES)), ""),
        "cuisine": pick(o.get("cuisine"), CUISINES),
        "mainIngredients": pick(o.get("mainIngredients"), MAINS),
        "tags": pick(o.get("tags"), TAGS),
        "equipment": pick(o.get("equipment"), EQUIPMENT),
        "equipmentNote": s(o.get("equipmentNote")).strip(),
        "servings": num(o.get("servings")),
        "yield": s(o.get("yield")).strip(),
        "prepMin": num(o.get("prepMin")), "cookMin": num(o.get("cookMin")), "totalMin": num(o.get("totalMin")),
        "timeNote": s(o.get("timeNote")).strip(),
        "kcal": num(o.get("kcal")),
        "glance": [s(x).strip() for x in lst(o.get("glance")) if s(x).strip()],
        "about": s(o.get("about")).strip(),
        "keyIngredients": [s(x).strip() for x in lst(o.get("keyIngredients")) if s(x).strip()],
        "ingredients": groups,
        "steps": [{"title": s(x.get("title")).strip().rstrip("."), "text": s(x.get("text")).strip(),
                   "timerMin": num(x.get("timerMin"))}
                  for x in lst(o.get("steps")) if isinstance(x, dict) and (x.get("title") or x.get("text"))],
        "tips": [{"label": s(x.get("label")).strip().rstrip(":"), "text": s(x.get("text")).strip()}
                 for x in lst(o.get("tips")) if isinstance(x, dict) and x.get("text")],
        "storage": [s(x).strip() for x in lst(o.get("storage")) if s(x).strip()],
        "serveWith": s(o.get("serveWith")).strip(),
        "notes": s(o.get("notes")).strip(),
        "transcript": s(o.get("transcript"))[:20000],
        "uncertain": [s(u) for u in lst(o.get("uncertain")) if u][:30],
        "cooks": sorted([{"date": s(x.get("date"))[:10], "servings": num(x.get("servings")),
                          "rating": num(x.get("rating")), "notes": s(x.get("notes")).strip()}
                         for x in lst(o.get("cooks")) if isinstance(x, dict) and re.match(r"\d{4}-\d{2}-\d{2}", s(x.get("date")))],
                        key=lambda c: c["date"]),
        "rating": num(o.get("rating")),
        "cover": clean_url(o.get("cover")),
        "icon": s(o.get("icon")).strip(),
        "review": bool(o.get("review", True)),
        "createdAt": o.get("createdAt"),
        "updatedAt": o.get("updatedAt"),
    }
    r["images"] = norm_images(o.get("images"), r["cover"], len(r["steps"]))
    if r["rating"] is not None:
        r["rating"] = max(1, min(5, int(round(r["rating"]))))

    def tidy(v):
        if isinstance(v, float) and v.is_integer():
            return int(v)
        if isinstance(v, list):
            return [tidy(x) for x in v]
        if isinstance(v, dict):
            return {k: tidy(x) for k, x in v.items()}
        return v
    return tidy(r)


# ---------- properties ----------
def to_props(r):
    src = r["source"] + (f" ({r['author']})" if r["author"] else "")
    return {
        "Name": r["name"],
        "Status": "To review" if r["review"] else "Ready",
        "Course": r["course"] or None,
        "Cuisine": json.dumps(r["cuisine"], ensure_ascii=False),
        "Main ingredient": json.dumps(r["mainIngredients"], ensure_ascii=False),
        "Tags": json.dumps(r["tags"], ensure_ascii=False),
        "Equipment": json.dumps(r["equipment"], ensure_ascii=False),
        "Servings": r["servings"],
        "Yield": r["yield"] or None,
        "Prep (min)": r["prepMin"], "Cook (min)": r["cookMin"], "Total (min)": r["totalMin"],
        "Key ingredients": ", ".join(r["keyIngredients"]) or None,
        "Source": src or None,
        "Link": r["link"] or None,
        "Language": r["language"],
        "Rating": "★" * r["rating"] if r["rating"] else None,
        "Times cooked": len(r["cooks"]),
        "date:Last cooked:start": r["cooks"][-1]["date"] if r["cooks"] else None,
    }


# ---------- page body ----------
def chunk_json(js, size=1800):
    """Split the JSON into lines for the code block, never next to whitespace (Notion trims line ends)."""
    out, i = [], 0
    while i < len(js):
        j = min(i + size, len(js))
        while j < len(js) and j > i + 1 and (js[j - 1].isspace() or js[j].isspace()):
            j -= 1
        out.append(js[i:j]); i = j
    return out


def mins(m):
    if m is None:
        return ""
    m = int(m)
    if m < 60:
        return f"{m} min"
    h, mm = divmod(m, 60)
    return f"{h} h" + (f" {mm} min" if mm else "")


def serve_txt(r):
    y, sv = r["yield"], r["servings"]
    if y and re.search(r"people|serv|person", y, re.I):
        return "Serves " + re.sub(r"^serves\s+", "", y, flags=re.I)
    if y:
        return "Makes " + y
    if sv:
        return f"Serves {sv:g}"
    return ""


def to_markdown(r):
    out = ["## At a glance"]
    who = ", ".join(x for x in (r["source"], r["author"]) if x)
    if who:
        src = f"[{esc(who)}]({r['link']})" if r["link"] else esc(who)
        out.append(f"- Source: {src}" + (" (in Dutch)" if r["language"] == "Dutch" else ""))
    p, c, t = r["prepMin"], r["cookMin"], r["totalMin"]
    times = [f"Prep {mins(p)}" if p is not None else "", f"Cook {mins(c)}" if c is not None else "",
             f"Total {mins(t)}" if t is not None and t != (p or 0) + (c or 0) else ""]
    line = " · ".join(x for x in [serve_txt(r), *times, r["timeNote"]] if x)
    if line:
        out.append("- " + esc(line))
    eq = r["equipmentNote"] or ", ".join(e if e == "BBQ" else e.lower() for e in r["equipment"])
    if eq:
        out.append("- Equipment: " + esc(eq[0].upper() + eq[1:]))
    if r["kcal"]:
        out.append(f"- About {r['kcal']:g} kcal per serving")
    out += ["- " + esc(g) for g in r["glance"]]

    if r["uncertain"]:
        if r["review"]:
            out.append('<callout icon="⚠️" color="yellow_bg">\n\t**Check before cooking**\n'
                       + "\n".join("\t- " + esc(u) for u in r["uncertain"]) + "\n</callout>")
        else:
            out += ["## Assumptions", *["- " + esc(u) for u in r["uncertain"]]]
    if r["about"]:
        out += ["## About", esc(r["about"])]
    img = lambda i, ind="": f"{ind}![{esc(i['caption'])}]({i['url']})"
    gallery = [i for i in r["images"] if not i["step"]]
    if gallery:
        out.append("## Photos")
        if len(gallery) == 1:
            out.append(img(gallery[0]))
        else:
            for k in range(0, len(gallery), 2):
                pair = gallery[k:k + 2]
                out.append("<columns>\n" + "\n".join("\t<column>\n" + img(i, "\t\t") + "\n\t</column>" for i in pair)
                           + "\n</columns>")

    if r["ingredients"]:
        out.append("## Ingredients")
        multi = len(r["ingredients"]) > 1
        for g in r["ingredients"]:
            if g["group"] and multi:
                out.append("### " + esc(g["group"]))
            out += ["- " + esc(ing_line(i)) for i in g["items"]]

    if r["steps"]:
        out.append("## Method")
        for n, st in enumerate(r["steps"], 1):
            title = f"**{esc(st['title'])}.**" if st["title"] else ""
            out.append(f"{n}. " + " ".join(x for x in (title, esc(st["text"])) if x))
            out += [img(i, "\t") for i in r["images"] if i["step"] == n]

    if r["tips"]:
        out.append("## Tips and variations")
        out += [("- **" + esc(t["label"]) + ":** " if t["label"] else "- ") + esc(t["text"]) for t in r["tips"]]
    if r["storage"]:
        out += ["## Storage and reheating", *["- " + esc(x) for x in r["storage"]]]
    if r["serveWith"]:
        out += ["## Serve with", esc(r["serveWith"])]
    if r["notes"]:
        out += ["## Notes", *[esc(l) for l in r["notes"].split("\n") if l.strip()]]

    out.append("## Cook log")
    if r["cooks"]:
        cell = lambda v: f"\t\t<td>{esc(v)}</td>"
        rows = ['<table header-row="true">', "\t<tr>", *[cell(h) for h in ("Date", "Serves", "Rating", "Notes")], "\t</tr>"]
        for ck in reversed(r["cooks"]):
            rows += ["\t<tr>", cell(ck["date"]), cell(f"{ck['servings']:g}" if ck["servings"] else ""),
                     cell("★" * int(ck["rating"]) if ck["rating"] else ""), cell(ck["notes"]), "\t</tr>"]
        rows.append("</table>")
        out.append("\n".join(rows))
    else:
        out.append("Not cooked yet.")

    if r["transcript"]:
        out += ['## Transcription {toggle="true"}', *["\t" + esc(l) for l in re.split(r"\n+", r["transcript"]) if l.strip()]]
    js = json.dumps({"v": 1, **r}, ensure_ascii=False, separators=(",", ":"))
    out += ["---", '## App data {toggle="true"}',
            "\tUsed by the Recipe book app. Edit recipes with the Recipe book skill so this stays in sync.",
            "\t```json", *["\t" + ch for ch in chunk_json(js)], "\t```"]
    return "\n".join(out)


# ---------- check ----------
def check(raw):
    r = normalise(raw)
    flags = []
    for key, allowed, label in (("cuisine", CUISINES, "Cuisine"), ("mainIngredients", MAINS, "Main ingredient"),
                                ("tags", TAGS, "Tags"), ("equipment", EQUIPMENT, "Equipment")):
        d = dropped(raw.get(key), allowed)
        if d:
            flags.append(f"{label}: not in the database's list, dropped: {', '.join(d)}")
    if raw.get("course") and not r["course"]:
        flags.append(f"Course '{raw.get('course')}' isn't an option; pick one of {', '.join(COURSES)}")
    elif not r["course"]:
        flags.append("No course set")
    if not r["servings"] and not r["yield"]:
        flags.append("No servings or yield")
    if not r["ingredients"]:
        flags.append("No ingredients")
    if not r["steps"]:
        flags.append("No method steps")
    if not r["keyIngredients"]:
        flags.append("No keyIngredients (fills the Key ingredients property for searching)")
    if not r["about"]:
        flags.append("No 'about' paragraph")
    if r["link"] and not r["cover"]:
        flags.append("No cover image: use the page's main photo (og:image)")
    if r["link"] and not r["images"] and not raw.get("noImages"):
        flags.append("No images: add the recipe's own photos (step photos with their step number), "
                     "or set noImages: true if the page genuinely has none beyond the cover")
    bad = [str(x.get("url") if isinstance(x, dict) else x) for x in (raw.get("images") or [])
           if not clean_url(x.get("url") if isinstance(x, dict) else x).startswith("https://")]
    if bad:
        flags.append(f"Images dropped (not an http(s) URL): {', '.join(bad[:3])}")
    p, c, t = r["prepMin"], r["cookMin"], r["totalMin"]
    if t is not None and p is not None and c is not None and t < p + c:
        flags.append(f"Total time {t:g} min is less than prep + cook ({p + c:g} min)")
    for g in r["ingredients"]:
        for i in g["items"]:
            line = ing_line(i)
            if NON_METRIC.search(line):
                flags.append(f"Non-metric unit left in ingredient: {line}")
            if i["qty"] is None and not re.search(r"\b(pinch|splash|to taste|handful|sprig|salt and pepper|for )", line, re.I):
                flags.append(f"No quantity: {line}")
    for st in r["steps"]:
        if NON_METRIC.search(st["text"]):
            flags.append(f"Non-metric unit in step '{st['title']}'")
    return {"flags": flags, "ingredients": sum(len(g["items"]) for g in r["ingredients"]), "steps": len(r["steps"]),
            "images": len(r["images"]), "stepImages": sum(1 for i in r["images"] if i["step"])}


# ---------- extract from a fetched page ----------
def extract(text):
    m = re.search(r"```json\s*([\s\S]*?)```", text)
    data = None
    if m:
        raw = "".join(re.sub(r"^\t+", "", l) for l in m.group(1).split("\n"))
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = None
    return {"data": data}


def main(argv):
    if len(argv) < 3 or argv[1] not in ("build", "check", "extract"):
        print(__doc__)
        return 2
    cmd, path = argv[1], argv[2]
    raw = open(path, encoding="utf-8").read()
    if cmd == "extract":
        print(json.dumps(extract(raw), ensure_ascii=False, indent=1))
        return 0
    o = json.loads(raw)
    if cmd == "check":
        print(json.dumps(check(o), ensure_ascii=False, indent=1))
        return 0
    r = normalise(o)
    if "--review" in argv:
        r["review"] = True
    if "--ready" in argv:
        r["review"] = False
    icon = r["icon"] or ICONS.get(r["course"], "🍽️")
    print(json.dumps({"properties": to_props(r), "content": to_markdown(r), "icon": icon, "cover": r["cover"] or None},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
