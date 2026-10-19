#!/usr/bin/env python3
"""Brew book page builder.

Turns a recipe JSON file into the exact Notion payload the Brew book app reads,
checks the numbers, and pulls app data back out of a fetched page.

Usage:
  build_page.py build  recipe.json [--photo SRC ...] [--review|--ready] > payload.json
  build_page.py check  recipe.json            # calculated vs stated OG/FG/ABV/IBU/EBC
  build_page.py extract fetched_page.txt      # prints {"data": {...}, "photos": [...]}

payload.json = {"properties": {...}, "content": "...", "icon": "🍺"}
Pass properties/content/icon straight to Notion create-pages (or update-page:
update_properties + replace_content).
"""
import json, math, re, sys

USES = {"boil", "fwh", "whirlpool", "dryhop", "mash"}
STEP_KEYS = ["prep", "mash", "sparge", "boil", "chill", "ferment", "package"]
TAGS = ["Belgian", "Dutch", "German", "British", "American", "Pale", "Amber", "Dark", "Session", "Strong",
        "Hoppy", "Malty", "Roasty", "Spiced", "Wheat", "Smoked", "Sour", "Clone", "Competition", "Course"]
TYPES = {"grain", "adjunct", "extract", "sugar"}
PPG_DEFAULT = {"grain": 37, "adjunct": 34, "extract": 36, "sugar": 46}


# ---------- helpers ----------
def num(v):
    if v is None or v == "":
        return None
    try:
        n = float(str(v).strip().replace(",", "."))
        return n if math.isfinite(n) else None
    except ValueError:
        return None


def nnum(v, d=None):
    if v is None:
        return ""
    v = float(v)
    if d is not None:
        return f"{v:.{d}f}"
    s = f"{round(v, 3):.3f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def n_esc(s):
    s = "" if s is None else str(s)
    s = re.sub(r"([\\*~`$\[\]<>{}|^])", r"\\\1", s)
    return re.sub(r"\n+", " ", s)


def use_txt(h):
    t = h.get("time")
    tt = nnum(t) if t is not None else None
    u = h.get("use")
    if u == "boil":
        return f"{tt if tt is not None else '?'} min"
    if u == "fwh":
        return "First wort"
    if u == "whirlpool":
        return "Whirlpool" + (f", {tt} min" if tt is not None else "")
    if u == "dryhop":
        return "Dry hop" + (f", {tt} days" if tt is not None else "")
    if u == "mash":
        return "Mash"
    return u or ""


def table(head, rows):
    if not rows:
        return ""
    cell = lambda c: f"\t\t<td>{n_esc(c)}</td>"
    out = ['<table header-row="true">', "\t<tr>", *[cell(c) for c in head], "\t</tr>"]
    for r in rows:
        out += ["\t<tr>", *[cell(c) for c in r], "\t</tr>"]
    out.append("</table>")
    return "\n".join(out)


def uniq(xs):
    seen, out = set(), []
    for x in xs:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ---------- normalise ----------
def normalise(o):
    s = lambda v: "" if v is None else str(v)
    lst = lambda v: [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []
    r = {
        "name": s(o.get("name")).strip() or "Untitled recipe",
        "style": s(o.get("style")).strip(),
        "source": s(o.get("source")).strip(),
        "tags": [t for t in TAGS if t.lower() in {s(x).strip().lower() for x in (o.get("tags") or [])}],
        **{k: num(o.get(k)) for k in ("batchL", "boilMin", "efficiency", "og", "fg", "abv", "ibu", "ebc")},
        "fermentables": [{"name": s(x.get("name")), "kg": num(x.get("kg")), "ebc": num(x.get("ebc")), "ppg": num(x.get("ppg")),
                          "type": x.get("type") if x.get("type") in TYPES else "grain", "when": s(x.get("when"))} for x in lst(o.get("fermentables"))],
        "story": s(o.get("story")).strip(),
        "water": {k: num((o.get("water") or {}).get(k)) for k in ("strikeL", "strikeC", "spargeL", "spargeC", "preboilL")},
        "stepNotes": {k: s((o.get("stepNotes") or {}).get(k)).strip() for k in STEP_KEYS},
        "hops": [{"name": s(x.get("name")), "g": num(x.get("g")), "aa": num(x.get("aa")),
                  "use": x.get("use") if x.get("use") in USES else "boil", "time": num(x.get("time"))} for x in lst(o.get("hops"))],
        "yeast": [{"name": s(x.get("name")), "amount": s(x.get("amount")), "atten": num(x.get("atten"))} for x in lst(o.get("yeast"))],
        "mash": [{"name": s(x.get("name")), "tempC": num(x.get("tempC")), "min": num(x.get("min"))} for x in lst(o.get("mash"))],
        "ferment": [{"name": s(x.get("name")), "tempC": num(x.get("tempC")), "days": num(x.get("days"))} for x in lst(o.get("ferment"))],
        "other": [{"name": s(x.get("name")), "amount": s(x.get("amount")), "when": s(x.get("when"))} for x in lst(o.get("other"))],
        "brews": sorted([{"date": s(x.get("date"))[:10], "litres": num(x.get("litres")), "og": num(x.get("og")), "fg": num(x.get("fg")),
                          "abv": num(x.get("abv")), "notes": s(x.get("notes"))} for x in lst(o.get("brews")) if re.match(r"\d{4}-\d{2}-\d{2}", s(x.get("date")))],
                        key=lambda b: b["date"]),
        "notes": s(o.get("notes")),
        "transcript": s(o.get("transcript"))[:20000],
        "uncertain": [s(u) for u in (o.get("uncertain") or []) if u][:30],
        "photos": [],
        "review": bool(o.get("review", True)),
        "createdAt": o.get("createdAt"),
        "updatedAt": o.get("updatedAt"),
    }
    # whole-number floats back to ints so the JSON stays tidy
    def tidy(v):
        if isinstance(v, float) and v.is_integer():
            return int(v)
        if isinstance(v, list):
            return [tidy(x) for x in v]
        if isinstance(v, dict):
            return {k: tidy(x) for k, x in v.items()}
        return v
    return tidy(r)


# ---------- Notion payload ----------
def to_props(r):
    return {
        "Name": r["name"], "Status": "To review" if r["review"] else "Ready",
        "Style": r["style"], "Source": r["source"],
        "Batch (L)": r["batchL"], "Boil (min)": r["boilMin"], "Efficiency (%)": r["efficiency"],
        "OG": r["og"], "FG": r["fg"], "ABV (%)": r["abv"], "IBU": r["ibu"], "EBC": r["ebc"],
        "Malts": ", ".join(uniq([x["name"] for x in r["fermentables"]])),
        "Hops": ", ".join(uniq([x["name"] for x in r["hops"]])),
        "Yeast": ", ".join(uniq([x["name"] for x in r["yeast"]])),
        "Tags": r["tags"],
        "date:Last brewed:start": r["brews"][-1]["date"] if r["brews"] else None,
        "date:Last brewed:is_datetime": 0,
        "Times brewed": len(r["brews"]) or None,
    }


# ---------- method (same steps as the app's methodSteps) ----------
MASHED = lambda t: (not t) or t in ("grain", "adjunct")
def fx(v, d=0):
    return "–" if v is None else (f"{v:.{d}f}")
def litres(v):
    x = round(v * 10) / 10
    return (f"{x:.1f}" if x % 1 else str(int(x))) + " L"
def degc(v):
    return (f"{v:.1f}" if v % 1 else str(int(v))) + "°C"
def kg_txt(kg):
    return "–" if kg is None else (f"{round(kg * 1000)} g" if kg < 1 else nnum(round(kg, 3)) + " kg")
def g_txt(g):
    return "–" if g is None else (f"{round(g, 1):g} g" if g < 10 else f"{round(g)} g")
def when_min(w, boil):
    t = (w or "").lower()
    if not t:
        return None
    m = re.search(r"(\d+)\s*min", t)
    if m and re.search(r"left|remain|before the end", t):
        return min(int(m.group(1)), boil)
    if re.search(r"flame ?out|knock ?out|end of the boil|after the boil", t):
        return 0
    if re.search(r"start|begin|with the first wort|whole boil", t):
        return boil
    return None
def add_label(t, boil):
    return "At the start" if t >= boil else "At flameout" if t == 0 else f"{fx(t)} min left"
def use_short(h):
    t = h["time"]
    return {"boil": f"{nnum(t) if t is not None else '?'} min", "fwh": "first wort", "whirlpool": "hop stand" + (f", {nnum(t)} min" if t is not None else ""),
            "dryhop": "dry hop" + (f", {nnum(t)} days" if t is not None else ""), "mash": "mash"}.get(h["use"], h["use"])

def method_steps(r):
    n, w, steps = r.get("stepNotes") or {}, r.get("water") or {}, []
    ferms = [x for x in r["fermentables"] if x["name"]]
    hops = [h for h in r["hops"] if h["name"]]
    boil = r["boilMin"] or 60
    mashed = [x for x in ferms if MASHED(x["type"])]
    late = [x for x in ferms if not MASHED(x["type"])]
    yeast = [y["name"] + (f" ({y['amount']})" if y["amount"] else "") for y in r["yeast"] if y["name"]]
    W = lambda k: w.get(k)
    steps.append(dict(k="prep", title="Get ready", text="Weigh out the ingredients, prepare the yeast and clean and sanitise your kit.", tip=n.get("prep", ""), list=[]))
    if W("strikeL") is not None or W("strikeC") is not None:
        tc, calc = W("strikeC"), False
        grain = sum(x["kg"] or 0 for x in mashed)
        m0 = next((m["tempC"] for m in r["mash"] if m["tempC"] is not None), None)
        if tc is None and W("strikeL") and grain and m0 is not None:
            tc, calc = round((0.41 / (W("strikeL") / grain)) * (m0 - 18) + m0), True
        steps.append(dict(k="strike", title="Heat the strike water",
                          text=f"Heat {litres(W('strikeL')) + ' of water' if W('strikeL') is not None else 'the mash water'}{' to ' + ('about ' if calc else '') + degc(tc) if tc is not None else ''}."
                               + (" (Calculated to land the mash on temperature with grain at 18°C.)" if calc else "")))
    mash = [m for m in r["mash"] if m["tempC"] is not None or m["min"] is not None]
    for i, m in enumerate(mash):
        T = degc(m["tempC"]) if m["tempC"] is not None else ""
        M = f"{fx(m['min'])} min" if m["min"] is not None else ""
        out = re.search("out", m["name"] or "", re.I)
        title = f"Mash in{' at ' + T if T else ''}" if i == 0 else (f"Mash out{' at ' + T if T else ''}" if out else f"Raise to {T or 'the next rest'}")
        text = (f"Stir in the grain{' and hold at ' + T if T else ''}{' for ' + M if M else ''}." if i == 0
                else f"Raise the mash to {T or 'the next temperature'}{' and hold for ' + M if M else ''}.")
        steps.append(dict(k=f"mash{i}", title=title, text=text, tip=n.get("mash", "") if i == 0 else "",
                          list=[f"{kg_txt(x['kg'])} {x['name']}" for x in mashed] + [f"{g_txt(h['g'])} {h['name']}" for h in hops if h["use"] == "mash"] if i == 0 else []))
    if mashed:
        fwh = [h for h in hops if h["use"] == "fwh"]
        parts = [f"Sparge{' with ' + litres(W('spargeL')) if W('spargeL') is not None else ''}{' at ' + degc(W('spargeC')) if W('spargeC') is not None else ''}"]
        if W("preboilL") is not None:
            parts.append(f"collect about {litres(W('preboilL'))} of wort")
        steps.append(dict(k="sparge", title="Sparge", text=" and ".join(parts) + "." + (" Put the first wort hops in the kettle as the wort runs in." if fwh else ""),
                          tip=n.get("sparge", ""), list=[f"{g_txt(h['g'])} {h['name']}" for h in fwh]))
    adds = [(min(h["time"] if h["time"] is not None else boil, boil), f"{g_txt(h['g'])} {h['name']}") for h in hops if h["use"] == "boil"]
    loose = []
    for x in late:
        t = when_min(x["when"], boil); txt = f"{kg_txt(x['kg'])} {x['name']}"
        if t is not None: adds.append((t, txt))
        else: loose.append(txt + (f": {x['when']}" if x["when"] else ""))
    for o in r["other"]:
        if not o["name"] or re.search(r"bottl|ferment|dry", o["when"], re.I):
            continue
        t = when_min(o["when"], boil); txt = (o["amount"] + " " if o["amount"] else "") + o["name"]
        if t is not None and re.search(r"boil|flame|knock", o["when"], re.I): adds.append((t, txt))
        elif re.search("boil", o["when"], re.I): loose.append(f"{txt}: {o['when']}")
    adds.sort(key=lambda a: -a[0])
    steps.append(dict(k="boil", title=f"Boil for {fx(boil)} min", text="Bring the wort to a rolling boil and start the timer. Add each item when that many minutes are left.",
                      tip=n.get("boil", ""), list=loose, adds=adds, boil=boil))
    wp = [h for h in hops if h["use"] == "whirlpool"]
    if wp:
        t = max((h["time"] or 20) for h in wp)
        steps.append(dict(k="whirl", title="Hop stand", text=f"Turn off the heat, let the wort cool to below 80°C, add these hops and let them steep for {fx(t)} min.",
                          list=[f"{g_txt(h['g'])} {h['name']}" for h in wp]))
    pitch = next((f["tempC"] for f in r["ferment"] if f["tempC"] is not None), None)
    og_t = f" (target OG {r['og']:.3f})" if r["og"] else ""
    steps.append(dict(k="chill", title=f"Chill to {degc(pitch)}" if pitch is not None else "Chill the wort",
                      text=f"Chill the wort{' to ' + degc(pitch) if pitch is not None else ''} and take a gravity reading{og_t}. If it's high, top up with clean water to hit the target.",
                      tip=n.get("chill", "")))
    steps.append(dict(k="pitch", title="Pitch the yeast", text="Transfer the wort to a clean, sanitised fermenter, aerate it well and pitch the yeast.", list=yeast))
    ferm = [f"{m['name'] or 'Ferment'}{': ' + degc(m['tempC']) if m['tempC'] is not None else ''}{', ' + fx(m['days']) + ' days' if m['days'] is not None else ''}"
            for m in r["ferment"] if m["name"] or m["tempC"] is not None]
    dry = [h for h in hops if h["use"] == "dryhop"]
    text = ("Ferment as follows until the gravity holds steady for 3 days." if ferm else "Ferment until the gravity holds steady for 3 days.")
    if dry: text += f" Then dry hop for {fx(max((h['time'] or 3) for h in dry))} days."
    if r["fg"]: text += f" Target FG {r['fg']:.3f}."
    steps.append(dict(k="ferment", title="Ferment", text=text, tip=n.get("ferment", ""), list=ferm + [f"Dry hop: {g_txt(h['g'])} {h['name']}" for h in dry]))
    bott = [o["name"] + (", " + o["amount"] if o["amount"] else "") + ("" if o["when"].strip().lower() == "bottling" else f" ({o['when']})")
            for o in r["other"] if o["name"] and re.search(r"bottl|ferment|dry", o["when"], re.I)]
    steps.append(dict(k="package", title="Bottle", text="Bottle once the gravity has been stable for 3 days.", tip=n.get("package", ""), list=bott))
    return steps


def chunk_json(js, size=1800):
    """Split the JSON into lines for the code block, never next to whitespace (Notion trims line ends)."""
    out, i = [], 0
    while i < len(js):
        j = min(i + size, len(js))
        while j < len(js) and j > i + 1 and (js[j - 1].isspace() or js[j].isspace()):
            j -= 1
        out.append(js[i:j]); i = j
    return out


def to_markdown(r, photo_srcs=()):
    out = ["## At a glance"]
    if r["source"]:
        out.append(f"- Source: {n_esc(r['source'])}")
    if r["tags"]:
        out.append(f"- Tags: {n_esc(', '.join(r['tags']))}")
    b = lambda v, u: nnum(v) + u if v is not None else "not set"
    out.append(f"- Batch {b(r['batchL'], ' L')}, boil {b(r['boilMin'], ' min')}, efficiency {b(r['efficiency'], '%')}")
    t = [x for x in [
        r["og"] is not None and "OG " + nnum(r["og"], 3), r["fg"] is not None and "FG " + nnum(r["fg"], 3),
        r["abv"] is not None and "ABV " + nnum(r["abv"]) + "%", r["ibu"] is not None and "IBU " + nnum(r["ibu"]),
        r["ebc"] is not None and "EBC " + nnum(r["ebc"])] if x]
    if t:
        out.append("- Targets: " + ", ".join(t))
    if r["review"] and r["uncertain"]:
        out.append('<callout icon="⚠️" color="yellow_bg">\n\t**Check before brewing**\n' + "\n".join("\t- " + n_esc(u) for u in r["uncertain"]) + "\n</callout>")
    elif r["uncertain"]:
        out += ["## Assumptions", *["- " + n_esc(u) for u in r["uncertain"]]]
    if r["story"]:
        out += ["## Story", *[n_esc(p) for p in re.split(r"\n+", r["story"]) if p.strip()]]
    ing = []
    if r["fermentables"]:
        ing += ["### Fermentables", *[f"- {kg_txt(x['kg'])} {n_esc(x['name'])}" + (f", {nnum(x['ebc'])} EBC" if x["ebc"] is not None else "") + (f", {x['type']}" if x["type"] != "grain" else "") for x in r["fermentables"]]]
    if r["hops"]:
        rank = {"mash": 0, "fwh": 1, "boil": 2, "whirlpool": 3, "dryhop": 4}
        hs = sorted(r["hops"], key=lambda h: (rank.get(h["use"], 2), -(h["time"] or 0) if h["use"] != "dryhop" else (h["time"] or 0)))
        ing += ["### Hops", *[f"- {g_txt(h['g'])} {n_esc(h['name'])}" + (f" ({nnum(h['aa'])}% AA)" if h["aa"] is not None else "") + f", {use_short(h)}" for h in hs]]
    if r["yeast"]:
        ing += ["### Yeast", *[f"- {n_esc(y['name'])}" + (f": {n_esc(y['amount'])}" if y["amount"] else "") + (f" ({nnum(y['atten'])}% attenuation)" if y["atten"] is not None else "") for y in r["yeast"]]]
    if r["other"]:
        ing += ["### Other", *[f"- {n_esc(o['name'])}" + (f", {n_esc(o['amount'])}" if o["amount"] else "") + (f" ({n_esc(o['when'])})" if o["when"] else "") for o in r["other"]]]
    if ing:
        out += ["## Ingredients", *ing]
    out.append("## Method")
    for i2, st in enumerate(method_steps(r), 1):
        out.append(f"{i2}. **{n_esc(st['title'])}.** {n_esc(st['text'])}")
        kids = [f"{add_label(t, st['boil'])}: {txt}" for t, txt in st.get("adds", [])] + (st.get("list") or []) + (["Tip: " + st["tip"]] if st.get("tip") else [])
        out += ["\t- " + n_esc(k) for k in kids]
    if r["brews"]:
        g = lambda v: f"{v:.3f}" if v is not None else ""
        rows = [[b["date"], nnum(b["litres"]) + " L" if b["litres"] is not None else "", g(b["og"]), g(b["fg"]),
                 nnum(b["abv"]) + "%" if b["abv"] is not None else "", b["notes"]] for b in reversed(r["brews"])]
        out += ["## Brew history", table(["Date", "Into fermenter", "OG", "FG", "ABV", "Notes"], rows)]
    if r["notes"]:
        out += ["## Notes", *[n_esc(p) for p in re.split(r"\n+", r["notes"]) if p.strip()]]
    if r["transcript"]:
        out += ['## Transcription {toggle="true"}', *["\t" + n_esc(l) for l in re.split(r"\n+", r["transcript"]) if l.strip()]]
    data = {"v": 1, **r}
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out += ["---", '## App data {toggle="true"}', "\tUsed by the Brew book app. Edit recipes in the app or with the Brew book skill so this stays in sync.",
            "\t```json", *["\t" + c for c in chunk_json(js)], "\t```"]
    return "\n".join(out)


# ---------- calculations (same maths as the app) ----------
def stats(r, L=None, eff=None):
    L = num(L) or r["batchL"]
    eff = num(eff) or r["efficiency"] or 72
    if not L:
        return None
    pts = mcu = sugar_pts = 0.0
    any_f = False
    for f in r["fermentables"]:
        kg = f["kg"]
        if not kg:
            continue
        any_f = True
        ppg = f["ppg"] or PPG_DEFAULT.get(f["type"], 37)
        p = kg * ppg * 8.3454 / L * (eff / 100 if f["type"] in ("grain", "adjunct") else 1)
        pts += p
        if f["type"] == "sugar":
            sugar_pts += p
        if f["ebc"] is not None:
            mcu += kg * 2.20462 * (f["ebc"] / 1.97) / (L * 0.264172)
    if not any_f:
        return None
    og = 1 + pts / 1000
    att = (r["yeast"][0]["atten"] if r["yeast"] and r["yeast"][0]["atten"] else 75)
    # sugars ferment out almost completely; attenuation applies to the malt-derived points
    fg = 1 + (pts - sugar_pts) * (1 - att / 100) / 1000
    boil = r["boilMin"] or 60

    def tin(t):
        return 0 if not t or t <= 0 else 1.65 * 0.000125 ** (og - 1) * (1 - math.exp(-0.04 * t)) / 4.15
    ibu = ibu_boil = 0.0
    for h in r["hops"]:
        if not h["g"] or not h["aa"]:
            continue
        t = h["time"]
        u = {"boil": lambda: tin(min(t if t is not None else boil, boil)), "fwh": lambda: tin(boil) * 1.1,
             "whirlpool": lambda: tin(min(t if t is not None else 20, 30)) * 0.1}.get(h["use"], lambda: 0)()
        v = u * h["aa"] / 100 * h["g"] * 1000 / L
        ibu += v
        if h["use"] != "whirlpool":
            ibu_boil += v
    ebc = 1.4922 * mcu ** 0.6859 * 1.97 if mcu > 0 else None
    return {"og": og, "fg": fg, "abv": (og - fg) * 131.25, "ibu": ibu, "ibu_boil": ibu_boil, "ebc": ebc, "eff_used": eff}


def check(r):
    s = stats(r)
    if not s:
        return {"ok": False, "message": "Can't calculate: needs a batch size and fermentables with amounts."}
    flags = []
    def cmp(label, stated, calc, tol, fmt):
        if stated is None or calc is None:
            return
        if abs(stated - calc) > tol:
            flags.append(f"{label}: recipe says {fmt(stated)}, ingredients give {fmt(calc)}")
    # FG and ABV depend on yeast and process, so only ingredient-driven numbers are checked.
    if r["efficiency"] is not None:
        cmp("OG", r["og"], s["og"], 0.004, lambda v: f"{v:.3f}")
    tol = max(5, 0.25 * r["ibu"]) if r["ibu"] is not None else 0
    # many recipe calculators ignore hop stands below 80°C, so accept either figure
    if r["ibu"] is not None and abs(r["ibu"] - s["ibu"]) > tol and abs(r["ibu"] - s["ibu_boil"]) > tol:
        flags.append(f"IBU: recipe says {r['ibu']:.0f}, hops give {s['ibu']:.0f}")
    if r["ebc"] is not None and s["ebc"] is not None and abs(r["ebc"] - s["ebc"]) > max(4, 0.3 * r["ebc"]):
        flags.append(f"EBC: recipe says {r['ebc']:.0f}, malts give {s['ebc']:.0f}")
    if r["og"] is not None and r["efficiency"] is None and r["fermentables"]:
        # efficiency the recipe implies
        mashed = sum(f["kg"] * (f["ppg"] or PPG_DEFAULT.get(f["type"], 37)) for f in r["fermentables"] if f["kg"] and f["type"] in ("grain", "adjunct"))
        sugar = sum(f["kg"] * (f["ppg"] or PPG_DEFAULT.get(f["type"], 37)) for f in r["fermentables"] if f["kg"] and f["type"] not in ("grain", "adjunct"))
        if mashed and r["batchL"]:
            need = (r["og"] - 1) * 1000 - sugar * 8.3454 / r["batchL"]
            implied = need / (mashed * 8.3454 / r["batchL"]) * 100
            flags.append(f"No efficiency given; the grain bill implies about {implied:.0f}% to reach OG {r['og']:.3f}")
    return {"ok": True, "calculated": {k: (round(v, 3) if k in ("og", "fg") else round(v, 1)) if isinstance(v, float) else v for k, v in s.items()}, "flags": flags}


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
    photos = re.findall(r"!\[[^\]]*\]\(((?:notion-file-block|file-upload|https?)://[^)\s]+)\)", text)
    return {"data": data, "photos": photos}


def main(argv):
    if len(argv) < 3 or argv[1] not in ("build", "check", "extract"):
        print(__doc__)
        return 2
    cmd, path = argv[1], argv[2]
    raw = open(path, encoding="utf-8").read()
    if cmd == "extract":
        print(json.dumps(extract(raw), ensure_ascii=False, indent=1))
        return 0
    r = normalise(json.loads(raw))
    if cmd == "check":
        print(json.dumps(check(r), ensure_ascii=False, indent=1))
        return 0
    photos, i = [], 3
    while i < len(argv):
        if argv[i] == "--photo" and i + 1 < len(argv):
            photos.append(argv[i + 1]); i += 2
        elif argv[i] == "--review":
            r["review"] = True; i += 1
        elif argv[i] == "--ready":
            r["review"] = False; i += 1
        else:
            i += 1
    print(json.dumps({"properties": to_props(r), "content": to_markdown(r, photos), "icon": "🍺"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
