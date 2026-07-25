"""
Generate animated-SVG mocks for the Surface-4 endgame finales (Visual Effects
Framework). Each match resolves to exactly one of three outcomes; each gets a
full-screen, card-less finale matching that row's character:

  heroes-win   triumphant victory bloom + confetti + a slow shine sweep
  scheme-wins  a dark deflating collapse — desaturate to ash, vignette closing
  tie          a wry, suspended, unresolved shimmer — two balanced orbs, held

CSS-only (animate on the JS-free ewiki via <img>), each loops and honours
@media (prefers-reduced-motion: reduce). Deterministic (seeded particles).

Output: surface4-heroes-win.svg, surface4-scheme-wins.svg, surface4-tie.svg
"""

import math

CW, CH = 640, 360
CX, CY = CW // 2, CH // 2


def seeded(seed, count):
    values = []
    for _ in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        values.append(seed / 0x7FFFFFFF)
    return values


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def scene(slug, title, aria, bg, defs, style, body):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="%s"/>\n'
        '  %s\n'
        '</svg>\n'
    ) % (CW, CH, CW, CH, aria, title, style, defs, CW, CH, bg, body)
    with open(slug + ".svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    return len(svg)


# ---------------------------------------------------------------------------
# heroes-win — triumphant victory bloom + confetti + slow shine sweep
# ---------------------------------------------------------------------------
def build_heroes_win():
    dur = 3.0
    bloom = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.2);" % (CX, CY)),
        (8, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.12);" % (CX, CY)),
        (16, "opacity: 0.92; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CY)),
        (55, "opacity: 0.85; transform: translate(%dpx,%dpx) scale(1.06);" % (CX, CY)),
        (86, "opacity: 0.8; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CY)),
        (95, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (CX, CY)),
        (100, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (CX, CY)),
    ]
    rays = [(0, "transform: translate(%dpx,%dpx) rotate(0deg);" % (CX, CY)),
            (100, "transform: translate(%dpx,%dpx) rotate(360deg);" % (CX, CY))]
    confetti = [
        (0, "opacity: 0; transform: translate(var(--x0), -30px) rotate(0deg);"),
        (6, "opacity: 1;"),
        (90, "opacity: 1;"),
        (100, "opacity: 0; transform: translate(calc(var(--x0) + var(--dx)), 392px) rotate(var(--spin));"),
    ]
    shine = [
        (0, "opacity: 0; transform: translate(-460px,0) rotate(18deg);"),
        (22, "opacity: 0; transform: translate(-460px,0) rotate(18deg);"),
        (30, "opacity: 0.5;"),
        (55, "opacity: 0.6; transform: translate(0px,0) rotate(18deg);"),
        (80, "opacity: 0; transform: translate(460px,0) rotate(18deg);"),
        (100, "opacity: 0; transform: translate(460px,0) rotate(18deg);"),
    ]
    colors = ["#ffd24a", "#fff", "#ffe9a8", "#ff9a3c", "#5ef08a", "#5ab0ff"]
    rnd = seeded(2024, 240)
    pieces = []
    for i in range(44):
        x0 = rnd[i * 5] * CW
        dx = (rnd[i * 5 + 1] - 0.5) * 150
        spin = (1 + rnd[i * 5 + 2] * 3) * 360 * (1 if i % 2 else -1)
        w = 6 + rnd[i * 5 + 3] * 4
        h = 10 + rnd[i * 5 + 4] * 7
        pieces.append('<g class="cf" style="--x0:%.0fpx; --dx:%.0fpx; --spin:%.0fdeg; animation-delay:%.2fs;">'
                      '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="1" fill="%s"/></g>'
                      % (x0, dx, spin, -(rnd[(i * 5 + 2) % 240] * dur), -w / 2, -h / 2, w, h, colors[i % len(colors)]))
    ray_nodes = "".join('<polygon points="0,0 470,-9 470,9" fill="#ffdf7a" transform="rotate(%d)"/>' % (i * 20)
                        for i in range(18))
    style = "\n".join([
        ".bloom { opacity: 0; animation: hbloom %ss ease-out infinite; }" % dur,
        ".rays { opacity: 0.44; animation: hrays 16s linear infinite; }",
        ".cf { opacity: 0; animation: hcf %ss linear infinite; }" % dur,
        ".shine { opacity: 0; animation: hshine %ss ease-in-out infinite; }" % dur,
        keyframes("hbloom", bloom), keyframes("hrays", rays),
        keyframes("hcf", confetti), keyframes("hshine", shine),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .bloom { animation: none; opacity: 0.9; transform: translate(%dpx,%dpx) scale(1); }\n"
        "  .rays { animation: none; opacity: 0.44; transform: translate(%dpx,%dpx); }\n"
        "  .cf, .shine { animation: none; opacity: 0; }\n}" % (CX, CY, CX, CY),
    ])
    defs = ('<radialGradient id="hb" cx="50%" cy="50%" r="50%">'
            '<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="35%" stop-color="#ffe9a8" stop-opacity="0.95"/>'
            '<stop offset="70%" stop-color="#ffb24a" stop-opacity="0.55"/>'
            '<stop offset="100%" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>'
            '<linearGradient id="hs" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset="0.5" stop-color="#fff" stop-opacity="0.8"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            '<radialGradient id="hbg" cx="50%" cy="42%" r="80%">'
            '<stop offset="0%" stop-color="#241a10" stop-opacity="1"/>'
            '<stop offset="100%" stop-color="#0b0910" stop-opacity="1"/></radialGradient>')
    body = ('<g class="rays">%s</g>'
            '<circle class="bloom" r="150" fill="url(#hb)"/>'
            '<g class="shine"><rect x="-90" y="-190" width="180" height="380" fill="url(#hs)"/></g>'
            '%s' % (ray_nodes, "".join(pieces)))
    return scene("surface4-heroes-win", "Surface-4 heroes-win — victory bloom finale",
                 "Animated mock of the heroes-win finale: a full-screen golden victory bloom with "
                 "rotating rays, a slow light sweep, and a storm of colourful confetti. Loops.",
                 "url(#hbg)", defs, style, body)


# ---------------------------------------------------------------------------
# scheme-wins — dark deflating collapse, desaturating to ash
# ---------------------------------------------------------------------------
def build_scheme_wins():
    dur = 3.2
    deflate = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (CX, CY)),
        (10, "opacity: 0.5; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CY)),
        (60, "opacity: 0.2; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CY)),
        (88, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.1);" % (CX, CY)),
        (100, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.1);" % (CX, CY)),
    ]
    ring = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(3.0); stroke-width: 1;" % (CX, CY)),
        (10, "opacity: 0; transform: translate(%dpx,%dpx) scale(2.8);" % (CX, CY)),
        (14, "opacity: 0.55;"),
        (64, "opacity: 0.15; transform: translate(%dpx,%dpx) scale(0.4); stroke-width: 5;" % (CX, CY)),
        (78, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.1); stroke-width: 6;" % (CX, CY)),
        (100, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.1);" % (CX, CY)),
    ]
    vig = [
        (0, "opacity: 0.12;"),
        (44, "opacity: 0.5;"),
        (72, "opacity: 0.72;"),
        (90, "opacity: 0.4;"),
        (100, "opacity: 0.12;"),
    ]
    ash = [
        (0, "opacity: 0; transform: translate(var(--x0), -20px);"),
        (10, "opacity: 0.7;"),
        (86, "opacity: 0.4;"),
        (100, "opacity: 0; transform: translate(calc(var(--x0) + var(--dx)), 380px);"),
    ]
    greys = ["#6b6b73", "#8a8a92", "#565660", "#9a9aa2"]
    rnd = seeded(1919, 200)
    motes = []
    for i in range(38):
        x0 = rnd[i * 4] * CW
        dx = (rnd[i * 4 + 1] - 0.5) * 40
        size = 2.5 + rnd[i * 4 + 2] * 3
        motes.append('<g class="ash" style="--x0:%.0fpx; --dx:%.0fpx; animation-delay:%.2fs;">'
                     '<circle r="%.1f" fill="%s"/></g>'
                     % (x0, dx, -(rnd[i * 4 + 3] * dur), size, greys[i % len(greys)]))
    style = "\n".join([
        ".deflate { opacity: 0; animation: sdeflate %ss ease-in infinite; }" % dur,
        ".sring { opacity: 0; fill: none; stroke: #8b8b95; animation: sring %ss ease-in infinite; }" % dur,
        ".svig { opacity: 0; animation: svig %ss ease-in-out infinite; }" % dur,
        ".ash { opacity: 0; animation: sash %ss linear infinite; }" % dur,
        keyframes("sdeflate", deflate), keyframes("sring", ring),
        keyframes("svig", vig), keyframes("sash", ash),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .deflate { animation: none; opacity: 0.15; transform: translate(%dpx,%dpx) scale(0.4); }\n"
        "  .sring, .ash { animation: none; opacity: 0; }\n"
        "  .svig { animation: none; opacity: 0.5; }\n}" % (CX, CY),
    ])
    defs = ('<radialGradient id="sd" cx="50%" cy="50%" r="50%">'
            '<stop offset="0%" stop-color="#9a9aa2" stop-opacity="0.7"/>'
            '<stop offset="100%" stop-color="#3a3a42" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="sv" cx="50%" cy="50%" r="72%">'
            '<stop offset="45%" stop-color="#000000" stop-opacity="0"/>'
            '<stop offset="100%" stop-color="#000000" stop-opacity="0.95"/></radialGradient>')
    body = ('<circle class="deflate" r="150" fill="url(#sd)"/>'
            '<g transform="translate(%d %d)"><circle class="sring" r="60"/></g>'
            '%s'
            '<rect class="svig" width="%d" height="%d" fill="url(#sv)"/>'
            % (CX, CY, "".join(motes), CW, CH))
    return scene("surface4-scheme-wins", "Surface-4 scheme-wins — deflating collapse to ash",
                 "Animated mock of the scheme-wins finale: a grey glow deflates and a ring collapses "
                 "inward while ash drifts down and a dark vignette closes in. Loops.",
                 "#0c0b10", defs, style, body)


# ---------------------------------------------------------------------------
# tie — wry, suspended, unresolved shimmer (two balanced orbs, held)
# ---------------------------------------------------------------------------
def build_tie():
    dur = 3.4
    left = [
        (0, "transform: translate(232px,180px);"),
        (25, "transform: translate(232px,166px);"),
        (50, "transform: translate(232px,180px);"),
        (75, "transform: translate(232px,194px);"),
        (100, "transform: translate(232px,180px);"),
    ]
    right = [
        (0, "transform: translate(408px,180px);"),
        (25, "transform: translate(408px,194px);"),
        (50, "transform: translate(408px,180px);"),
        (75, "transform: translate(408px,166px);"),
        (100, "transform: translate(408px,180px);"),
    ]
    shimmer = [(0, "opacity: 0.16;"), (50, "opacity: 0.42;"), (100, "opacity: 0.16;")]
    mote = [
        (0, "opacity: 0; transform: translateY(0) scale(0.6);"),
        (22, "opacity: 0.7;"),
        (50, "opacity: 0.5; transform: translateY(-26px) scale(1);"),
        (80, "opacity: 0.5;"),
        (100, "opacity: 0; transform: translateY(0) scale(0.6);"),
    ]
    rnd = seeded(777, 48)
    motes = []
    for i in range(10):
        mx = 90 + rnd[i * 3] * (CW - 180)
        my = 120 + rnd[i * 3 + 1] * 150
        r = 2 + rnd[i * 3 + 2] * 2.5
        motes.append('<g transform="translate(%.0f %.0f)"><circle class="tmote" r="%.1f" '
                     'style="animation-delay:%.2fs;"/></g>' % (mx, my, r, -(rnd[i * 3] * dur)))
    style = "\n".join([
        ".orbL { animation: tleft %ss ease-in-out infinite; }" % dur,
        ".orbR { animation: tright %ss ease-in-out infinite; }" % dur,
        ".shim { opacity: 0.16; animation: tshim %ss ease-in-out infinite; }" % dur,
        ".tmote { opacity: 0; fill: #cfd6ea; transform: translateY(0) scale(0.6); "
        "animation: tmote %ss ease-in-out infinite; }" % dur,
        keyframes("tleft", left), keyframes("tright", right),
        keyframes("tshim", shimmer), keyframes("tmote", mote),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .orbL { animation: none; transform: translate(232px,180px); }\n"
        "  .orbR { animation: none; transform: translate(408px,180px); }\n"
        "  .shim { animation: none; opacity: 0.3; }\n"
        "  .tmote { animation: none; opacity: 0; }\n}",
    ])
    defs = ('<radialGradient id="og" cx="50%" cy="50%" r="50%">'
            '<stop offset="0%" stop-color="#ffe6a0" stop-opacity="0.95"/>'
            '<stop offset="55%" stop-color="#ffcf47" stop-opacity="0.5"/>'
            '<stop offset="100%" stop-color="#ffcf47" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="ob" cx="50%" cy="50%" r="50%">'
            '<stop offset="0%" stop-color="#bfe0ff" stop-opacity="0.95"/>'
            '<stop offset="55%" stop-color="#5ab0ff" stop-opacity="0.5"/>'
            '<stop offset="100%" stop-color="#5ab0ff" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="ts" cx="50%" cy="50%" r="60%">'
            '<stop offset="0%" stop-color="#cfd6ea" stop-opacity="0.6"/>'
            '<stop offset="100%" stop-color="#cfd6ea" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="tbg" cx="50%" cy="46%" r="80%">'
            '<stop offset="0%" stop-color="#161822" stop-opacity="1"/>'
            '<stop offset="100%" stop-color="#0b0c12" stop-opacity="1"/></radialGradient>')
    body = ('<ellipse class="shim" cx="%d" cy="180" rx="150" ry="46" fill="url(#ts)"/>'
            '%s'
            '<g class="orbL"><circle r="52" fill="url(#og)"/></g>'
            '<g class="orbR"><circle r="52" fill="url(#ob)"/></g>'
            % (CX, "".join(motes)))
    return scene("surface4-tie", "Surface-4 tie — suspended, unresolved shimmer",
                 "Animated mock of the tie finale: a warm orb and a cool orb hover in balance, gently "
                 "see-sawing while a neutral shimmer holds between them — never resolving. Loops.",
                 "url(#tbg)", defs, style, body)


BUILDERS = [build_heroes_win, build_scheme_wins, build_tie]

if __name__ == "__main__":
    for builder in BUILDERS:
        print("built (%d bytes)" % builder())
