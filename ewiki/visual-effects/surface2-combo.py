"""
Generate animated-SVG mocks for the Surface-2 combo / chain-reaction signal
(Visual Effects Framework). One per tier, each pairing the tier's visual
(spark / burst / flourish) with the narrative synergy call-out that peaks with
it (Combo! / Team-Up! / Unstoppable!) — the flash and the word fire off the one
`lastPlayEffectsFired` scalar and peak together.

Card-less, CSS-only (animate on the JS-free ewiki via <img>), each loops and
honours @media (prefers-reduced-motion: reduce). The tiers escalate in canvas
size / intensity so a bigger chain literally looks bigger. Tier boundaries are
the locked Combo Tier Contract; the words are the narrative page's proposal.

Deterministic: particle layouts are seeded.

Output: surface2-combo-spark.svg, surface2-combo-burst.svg, surface2-combo-flourish.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")


def seeded(seed, count):
    values = []
    for _ in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        values.append(seed / 0x7FFFFFFF)
    return values


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def label_stops(cx, cy, hit, hold_end):
    base = "transform: translate(%dpx,%dpx)" % (cx, cy)
    return [
        (0, "opacity: 0; %s scale(0.4);" % base),
        (hit, "opacity: 0; %s scale(0.4);" % base),
        (hit + 2, "opacity: 1; %s scale(1.16);" % base),
        (hit + 4, "%s scale(1.0);" % base),
        (hold_end, "opacity: 1; %s scale(1.0);" % base),
        (hold_end + 10, "opacity: 0; %s scale(1.2);" % base),
        (100, "opacity: 0;"),
    ]


def scene(cw, ch, title, aria, defs, style, body):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
        '  %s\n'
        '</svg>\n'
    ) % (cw, ch, cw, ch, aria, title, style, defs, cw, ch, body)


BG = ('<radialGradient id="bg" cx="50%" cy="48%" r="80%">'
      '<stop offset="0%" stop-color="#171320" stop-opacity="1"/>'
      '<stop offset="100%" stop-color="#0b0910" stop-opacity="1"/></radialGradient>')


# ---------------------------------------------------------------------------
# T1 — spark + "Combo!"  (brief, modest)
# ---------------------------------------------------------------------------
def build_spark():
    cw, ch, cx, cy = 420, 200, 210, 100
    dur, hit = 1.8, 13.0
    flash = [
        (0, "opacity: 0; transform: scale(0);"),
        (hit, "opacity: 0; transform: scale(0.2);"),
        (hit + 2, "opacity: 0.8; transform: scale(0.55);"),
        (hit + 12, "opacity: 0; transform: scale(1.3);"),
        (100, "opacity: 0; transform: scale(1.3);"),
    ]
    shard = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (hit, "opacity: 0; transform: translate(0,0);"),
        (hit + 2, "opacity: 1;"),
        (hit + 20, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]
    rnd = seeded(3111, 40)
    shards = []
    for i in range(9):
        angle = (i / 9) * 2 * math.pi + (rnd[i * 3] - 0.5) * 0.5
        speed = 6 + rnd[i * 3 + 1] * 5
        length = 7 + rnd[i * 3 + 2] * 5
        tx, ty = math.cos(angle) * speed * 7, math.sin(angle) * speed * 7
        shards.append('<g class="sp" style="--tx:%.0fpx; --ty:%.0fpx;">'
                      '<rect x="-1.5" y="%.0f" width="3" height="%.0f" rx="1.5" fill="#dff0ff" '
                      'transform="rotate(%.0f)"/></g>' % (tx, ty, -length, length, math.degrees(angle) + 90))
    style = "\n".join([
        "text { %s }" % FONT,
        ".flash { opacity: 0; animation: flash %ss ease-out infinite; }" % dur,
        ".sp { opacity: 0; transform: translate(0,0); animation: sp %ss ease-out infinite; }" % dur,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % dur,
        keyframes("flash", flash),
        keyframes("sp", shard),
        keyframes("lbl", label_stops(cx, cy, hit, 74)),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .flash, .sp { animation: none; opacity: 0; }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}" % (cx, cy),
    ])
    defs = ('%s<radialGradient id="fl" cx="50%%" cy="50%%" r="50%%">'
            '<stop offset="0%%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="60%%" stop-color="#bcdcff" stop-opacity="0.7"/>'
            '<stop offset="100%%" stop-color="#5ab0ff" stop-opacity="0"/></radialGradient>' % BG)
    body = ('<g transform="translate(%d %d)"><circle class="flash" r="34" fill="url(#fl)"/>%s</g>'
            '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
            'font-size="40" fill="#bcdcff">COMBO!</text>' % (cx, cy, "".join(shards)))
    return scene(cw, ch, "Surface-2 combo T1 — spark + Combo!",
                 "Animated mock of the tier-1 combo cue: a brief blue spark bursts as the word Combo! "
                 "pops on-screen, then fades. Loops.", defs, style, body)


# ---------------------------------------------------------------------------
# T2 — burst + "Team-Up!"  (larger, shockwave ring)
# ---------------------------------------------------------------------------
def build_burst():
    cw, ch, cx, cy = 480, 240, 240, 120
    dur, hit = 2.0, 13.0
    flash = [
        (0, "opacity: 0; transform: scale(0);"),
        (hit, "opacity: 0; transform: scale(0.2);"),
        (hit + 2, "opacity: 0.9; transform: scale(0.6);"),
        (hit + 15, "opacity: 0; transform: scale(1.6);"),
        (100, "opacity: 0; transform: scale(1.6);"),
    ]
    ring = [
        (0, "opacity: 0; transform: scale(0.1); stroke-width: 6;"),
        (hit, "opacity: 0; transform: scale(0.1); stroke-width: 6;"),
        (hit + 1, "opacity: 0.85;"),
        (hit + 22, "opacity: 0; transform: scale(1.7); stroke-width: 1;"),
        (100, "opacity: 0; transform: scale(1.7); stroke-width: 1;"),
    ]
    shard = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (hit, "opacity: 0; transform: translate(0,0);"),
        (hit + 2, "opacity: 1;"),
        (hit + 24, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]
    rnd = seeded(6222, 60)
    shards = []
    for i in range(16):
        angle = (i / 16) * 2 * math.pi + (rnd[i * 3] - 0.5) * 0.4
        speed = 8 + rnd[i * 3 + 1] * 6
        size = 8 + rnd[i * 3 + 2] * 7
        tx, ty = math.cos(angle) * speed * 8, math.sin(angle) * speed * 8
        pts = "%.0f,0 %.0f,%.0f %.0f,%.0f" % (size, -size * 0.4, size * 0.32, -size * 0.4, -size * 0.32)
        shards.append('<g class="bs" style="--tx:%.0fpx; --ty:%.0fpx;">'
                      '<polygon points="%s" fill="#ffe27a" transform="rotate(%.0f)"/></g>'
                      % (tx, ty, pts, math.degrees(angle)))
    style = "\n".join([
        "text { %s }" % FONT,
        ".flash { opacity: 0; animation: flash %ss ease-out infinite; }" % dur,
        ".ring { opacity: 0; fill: none; stroke: #ffdd6a; animation: ring %ss ease-out infinite; }" % dur,
        ".bs { opacity: 0; transform: translate(0,0); animation: bs %ss ease-out infinite; }" % dur,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % dur,
        keyframes("flash", flash),
        keyframes("ring", ring),
        keyframes("bs", shard),
        keyframes("lbl", label_stops(cx, cy, hit, 76)),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .flash, .bs { animation: none; opacity: 0; }\n"
        "  .ring { animation: none; opacity: 0.4; transform: scale(1.2); }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}" % (cx, cy),
    ])
    defs = ('%s<radialGradient id="fl" cx="50%%" cy="50%%" r="50%%">'
            '<stop offset="0%%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="55%%" stop-color="#ffe27a" stop-opacity="0.85"/>'
            '<stop offset="100%%" stop-color="#ffb020" stop-opacity="0"/></radialGradient>' % BG)
    body = ('<g transform="translate(%d %d)"><circle class="flash" r="48" fill="url(#fl)"/>'
            '<circle class="ring" r="34"/>%s</g>'
            '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
            'font-size="52" fill="#74eca2">TEAM-UP!</text>' % (cx, cy, "".join(shards)))
    return scene(cw, ch, "Surface-2 combo T2 — burst + Team-Up!",
                 "Animated mock of the tier-2 combo cue: a larger gold burst with an expanding "
                 "shockwave ring as the word Team-Up! pops on-screen, then fades. Loops.",
                 defs, style, body)


# ---------------------------------------------------------------------------
# T3 — full-screen ascending flourish + "Unstoppable!"
# ---------------------------------------------------------------------------
def build_flourish():
    cw, ch, cx, cy = 640, 340, 320, 170
    dur, hit = 2.4, 12.0
    bloom = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.2);" % (cx, cy)),
        (hit, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.3);" % (cx, cy)),
        (hit + 4, "opacity: 0.9; transform: translate(%dpx,%dpx) scale(1.05);" % (cx, cy)),
        (60, "opacity: 0.7; transform: translate(%dpx,%dpx) scale(1.0);" % (cx, cy)),
        (88, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (cx, cy)),
        (100, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (cx, cy)),
    ]
    rays_spin = [
        (0, "transform: translate(%dpx,%dpx) rotate(0deg);" % (cx, cy)),
        (100, "transform: translate(%dpx,%dpx) rotate(360deg);" % (cx, cy)),
    ]
    rise = [
        (0, "opacity: 0; transform: translate(var(--x0), 0px);"),
        (8, "opacity: 1;"),
        (86, "opacity: 0.7;"),
        (100, "opacity: 0; transform: translate(calc(var(--x0) + var(--dx)), var(--up));"),
    ]
    rnd = seeded(9333, 120)
    streaks = []
    colors = ["#ffd24a", "#ff9a3c", "#ffe9a8", "#fff"]
    for i in range(16):
        x0 = 40 + rnd[i * 4] * (cw - 80)
        dx = (rnd[i * 4 + 1] - 0.5) * 60
        up = -(180 + rnd[i * 4 + 2] * 180)
        height = 12 + rnd[i * 4 + 3] * 16
        delay = -(rnd[(i * 4 + 1) % 120] * dur)
        color = colors[i % len(colors)]
        streaks.append('<g class="fs" style="--x0:%.0fpx; --dx:%.0fpx; --up:%.0fpx; animation-delay:%.2fs;" '
                       'transform="translate(0 %d)">'
                       '<rect x="-2" y="%.0f" width="4" height="%.0f" rx="2" fill="%s"/></g>'
                       % (x0, dx, up, delay, ch + 10, -height, height, color))
    ray_nodes = "".join('<polygon points="0,0 360,-8 360,8" fill="#ffdf7a" transform="rotate(%d)"/>' % (i * 24)
                        for i in range(15))
    style = "\n".join([
        "text { %s }" % FONT,
        ".bloom { opacity: 0; animation: bloom %ss ease-out infinite; }" % dur,
        ".rays { opacity: 0.36; animation: rays 14s linear infinite; }",
        ".fs { opacity: 0; animation: fs %ss linear infinite; }" % dur,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % dur,
        keyframes("bloom", bloom),
        keyframes("rays", rays_spin),
        keyframes("fs", rise),
        keyframes("lbl", label_stops(cx, cy, hit, 82)),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .bloom { animation: none; opacity: 0.8; transform: translate(%dpx,%dpx) scale(1); }\n"
        "  .rays { animation: none; opacity: 0.36; transform: translate(%dpx,%dpx); }\n"
        "  .fs { animation: none; opacity: 0; }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}"
        % (cx, cy, cx, cy, cx, cy),
    ])
    defs = ('%s<radialGradient id="bl" cx="50%%" cy="50%%" r="50%%">'
            '<stop offset="0%%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="38%%" stop-color="#ffe9a8" stop-opacity="0.9"/>'
            '<stop offset="72%%" stop-color="#ffb24a" stop-opacity="0.5"/>'
            '<stop offset="100%%" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>' % BG)
    body = ('<g class="rays">%s</g>'
            '<circle class="bloom" r="150" fill="url(#bl)"/>'
            '%s'
            '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
            'font-size="62" fill="#ff9a3c">UNSTOPPABLE!</text>'
            % (ray_nodes, "".join(streaks)))
    return scene(cw, ch, "Surface-2 combo T3 — ascending flourish + Unstoppable!",
                 "Animated mock of the tier-3 combo cue: a full-screen golden bloom with rotating rays "
                 "and ascending streaks of light rising up the screen as the word Unstoppable! pops, "
                 "then loops.", defs, style, body)


FILES = [
    ("surface2-combo-spark", build_spark),
    ("surface2-combo-burst", build_burst),
    ("surface2-combo-flourish", build_flourish),
]

if __name__ == "__main__":
    for slug, builder in FILES:
        svg = builder()
        with open(slug + ".svg", "w", encoding="utf-8") as handle:
            handle.write(svg)
        print("%-32s %6d bytes" % (slug + ".svg", len(svg)))
