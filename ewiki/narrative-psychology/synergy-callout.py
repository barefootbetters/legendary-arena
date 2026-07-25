"""
Generate an animated-SVG mock of the synergy call-out ladder for the
Narrative Psychology Framework wiki page: the escalating on-screen word that
pops as a hero-ability chain grows (Combo! -> Team-Up! -> Unstoppable! ->
LEGENDARY!). CSS-only (animates on the JS-free ewiki via <img>), loops, and
honours @media (prefers-reduced-motion: reduce).

The tier boundaries are the locked Combo Tier Contract; the words are the
page's naming proposal. This is an illustrative mock, not a shipped asset.

Output: synergy-callout-ladder.svg
"""

CW, CH = 560, 200
CX, CY = CW // 2, CH // 2
DUR = 5.2  # seconds; four 25% slots, one word each

WORDS = [
    ("COMBO!",        42, "#bcdcff"),
    ("TEAM-UP!",      54, "#74eca2"),
    ("UNSTOPPABLE!",  60, "#ff8f3a"),
    ("LEGENDARY!",    68, "#ffd24a"),
]


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def word_stops(index):
    """Absolute keyframe stops for the word in slot `index` (0..3)."""
    start = index * 25.0
    base = "transform: translate(%dpx,%dpx)" % (CX, CY)
    stops = [(0, "opacity: 0;")]
    if start > 0:
        stops.append((start, "opacity: 0; %s scale(0.4);" % base))
    else:
        stops[0] = (0, "opacity: 0; %s scale(0.4);" % base)
    stops += [
        (start + 1.5, "opacity: 1; %s scale(1.15);" % base),
        (start + 3.0, "%s scale(1.0);" % base),
        (start + 19.0, "opacity: 1; %s scale(1.0);" % base),
        (start + 23.0, "opacity: 0; %s scale(1.28);" % base),
        (100, "opacity: 0;"),
    ]
    return stops


glow_stops = [
    (0, "opacity: 0;"),
    (75, "opacity: 0;"),
    (77, "opacity: 0.55;"),
    (94, "opacity: 0.55;"),
    (98, "opacity: 0;"),
    (100, "opacity: 0;"),
]

style_parts = []
for i, (_word, _size, _color) in enumerate(WORDS):
    style_parts.append(".w%d { opacity: 0; animation: w%d %ss linear infinite; }" % (i, i, DUR))
style_parts.append(".lglow { opacity: 0; animation: lg %ss linear infinite; }" % DUR)
style_parts.append("text { font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
                   "font-weight: 900; font-style: italic; letter-spacing: 1px; }")
for i in range(len(WORDS)):
    style_parts.append(keyframes("w%d" % i, word_stops(i)))
style_parts.append(keyframes("lg", glow_stops))
style_parts.append(
    "@media (prefers-reduced-motion: reduce) {\n"
    "  .w0, .w1, .w2 { animation: none; opacity: 0; }\n"
    "  .w3 { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n"
    "  .lglow { animation: none; opacity: 0.5; }\n"
    "}" % (CX, CY)
)
style = "\n".join(style_parts)

word_nodes = []
for i, (word, size, color) in enumerate(WORDS):
    word_nodes.append(
        '<text class="w%d" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        'font-size="%d" fill="%s">%s</text>' % (i, size, color, word))

defs = ('<radialGradient id="lg" cx="50%" cy="50%" r="50%">'
        '<stop offset="0%" stop-color="#ffe6a0" stop-opacity="0.9"/>'
        '<stop offset="100%" stop-color="#ffb020" stop-opacity="0"/></radialGradient>'
        '<radialGradient id="bg" cx="50%" cy="45%" r="80%">'
        '<stop offset="0%" stop-color="#171320" stop-opacity="1"/>'
        '<stop offset="100%" stop-color="#0b0910" stop-opacity="1"/></radialGradient>')

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
    'role="img" aria-label="%s">\n'
    '  <title>Synergy call-out ladder — Combo! to Team-Up! to Unstoppable! to LEGENDARY!</title>\n'
    '  <style>\n%s\n  </style>\n'
    '  <defs>%s</defs>\n'
    '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
    '  <ellipse class="lglow" cx="%d" cy="%d" rx="240" ry="72" fill="url(#lg)"/>\n'
    '  %s\n'
    '</svg>\n'
) % (CW, CH, CW, CH,
     "Animated mock of the synergy call-out ladder: the words Combo!, then Team-Up!, then "
     "Unstoppable!, then a gold glowing LEGENDARY! each pop on-screen in turn as a hero-ability "
     "chain grows, then the sequence loops.",
     style, defs, CW, CH, CX, CY, "".join(word_nodes))

with open("synergy-callout-ladder.svg", "w", encoding="utf-8") as handle:
    handle.write(svg)
print("SVG written:", len(svg), "bytes")
