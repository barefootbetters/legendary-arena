"""
Generate the animated-SVG mock for the proposed "shield block" defensive
effect (Visual Effects Framework wiki page) — Captain America's shield
spinning in to intercept an incoming Master Strike: a metallic CLANG flash
ring, a spark ricochet, the red strike energy shattering and deflecting
harmlessly, and a BLOCKED! call-out.

Card-less and vector-only (the shield is drawn as crisp concentric rings +
a white star, not a photo), CSS-only so it animates on the JS-free ewiki
via <img>, loops, and honours @media (prefers-reduced-motion: reduce) by
holding a single static frame (shield planted, BLOCKED! shown, no motion).

Deterministic: spark / deflect-shard layouts are seeded; no runtime
randomness.

This is a PROPOSAL mock. Unlike the shipped combo layer and the Surface-1
notable-event set, there is no engine "prevention / block" signal today
(the notable events are the locked set plus deferred `escapeResolved`), so
this effect is blocked on a new engine event (a proposed `strikeBlocked` /
prevention event) — Tier 3, the same posture as escape effects. The visual
generalises to a Scheme Twist (recolour the threat purple) or an Ambush
(green); the Master Strike (red) is drawn here as the flagship case.

Output: block-shield.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")

CW, CH = 460, 340
CX, CY = CW / 2, CH / 2 + 6   # nudge the impact point below centre for headroom
DUR = 2.8
HIT = 37.0                    # percent of the loop when the shield meets the strike
SHIELD_R = 84


def seeded(seed, count):
    """Deterministic pseudo-random floats in [0,1) — no runtime randomness."""
    values = []
    for _ in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        values.append(seed / 0x7FFFFFFF)
    return values


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def star(radius, fill):
    """A 5-point star pointing up, centred at the local origin."""
    inner = radius * 0.42
    points = []
    for i in range(5):
        outer_angle = math.radians(-90 + i * 72)
        inner_angle = math.radians(-90 + i * 72 + 36)
        points.append((math.cos(outer_angle) * radius, math.sin(outer_angle) * radius))
        points.append((math.cos(inner_angle) * inner, math.sin(inner_angle) * inner))
    point_string = " ".join("%.1f,%.1f" % (x, y) for x, y in points)
    return '<polygon points="%s" fill="%s"/>' % (point_string, fill)


def shield_art():
    """Captain America's shield: concentric red/white/red rings, a blue core,
    a white star, and a soft metallic sheen. Centred at the local origin."""
    rings = [
        (SHIELD_R,        "#c0182f"),   # outer red
        (SHIELD_R * 0.82, "#eeeae0"),   # white
        (SHIELD_R * 0.63, "#c0182f"),   # inner red
        (SHIELD_R * 0.44, "#123f8f"),   # blue core
    ]
    parts = ['<circle r="%.1f" fill="%s"/>' % (radius, colour) for radius, colour in rings]
    parts.append(star(SHIELD_R * 0.33, "#f4f4f4"))
    # why: a faint off-centre highlight reads as brushed metal without a raster texture
    parts.append('<circle r="%.1f" fill="url(#sheen)"/>' % SHIELD_R)
    parts.append('<circle r="%.1f" fill="none" stroke="#7a0f1e" stroke-width="2"/>' % SHIELD_R)
    return "".join(parts)


def build():
    base = "translate(%dpx,%dpx)" % (CX, CY)

    # Incoming Master Strike: a red energy bolt driving down onto the impact point.
    bolt = [
        (0, "opacity: 0; transform: translate(%dpx,-70px);" % CX),
        (8, "opacity: 1; transform: translate(%dpx,-70px);" % CX),
        (HIT, "opacity: 1; transform: translate(%dpx,%dpx);" % (CX, CY)),
        (HIT + 2, "opacity: 0; transform: translate(%dpx,%dpx);" % (CX, CY + 6)),
        (100, "opacity: 0; transform: translate(%dpx,%dpx);" % (CX, CY + 6)),
    ]

    # The shield spins in and plants exactly on impact, with a small recoil.
    shield = [
        (0, "opacity: 0; transform: %s scale(0.15) rotate(-210deg);" % base),
        (HIT - 9, "opacity: 0.25; transform: %s scale(0.55) rotate(-95deg);" % base),
        (HIT, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.07) rotate(0deg);" % (CX, CY + 4)),
        (HIT + 4, "opacity: 1; transform: translate(%dpx,%dpx) scale(0.97) rotate(3deg);" % (CX, CY + 9)),
        (HIT + 9, "opacity: 1; transform: %s scale(1.0) rotate(0deg);" % base),
        (90, "opacity: 1; transform: %s scale(1.0) rotate(0deg);" % base),
        (96, "opacity: 0; transform: %s scale(1.05) rotate(6deg);" % base),
        (100, "opacity: 0; transform: %s scale(0.15) rotate(-210deg);" % base),
    ]

    # Metallic CLANG flash on the shield face.
    clang = [
        (0, "opacity: 0; transform: %s scale(0);" % base),
        (HIT, "opacity: 0; transform: %s scale(0.3);" % base),
        (HIT + 1.5, "opacity: 0.95; transform: %s scale(0.7);" % base),
        (HIT + 15, "opacity: 0; transform: %s scale(1.8);" % base),
        (100, "opacity: 0; transform: %s scale(1.8);" % base),
    ]
    ring = [
        (0, "opacity: 0; transform: %s scale(0.1); stroke-width: 7;" % base),
        (HIT, "opacity: 0; transform: %s scale(0.15); stroke-width: 7;" % base),
        (HIT + 1, "opacity: 0.9;"),
        (HIT + 22, "opacity: 0; transform: %s scale(1.9); stroke-width: 1;" % base),
        (100, "opacity: 0; transform: %s scale(1.9); stroke-width: 1;" % base),
    ]

    # White/gold sparks ricocheting off the impact, plus red shards — the
    # shattered strike energy deflecting away harmlessly.
    burst = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (HIT, "opacity: 0; transform: translate(0,0);"),
        (HIT + 2, "opacity: 1;"),
        (HIT + 22, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    rnd = seeded(1941, 120)   # why: 1941 — Captain America's debut year, a fixed seed
    sparks = []
    for i in range(14):
        angle = (i / 14) * 2 * math.pi + (rnd[i * 3] - 0.5) * 0.5
        speed = 9 + rnd[i * 3 + 1] * 7
        length = 8 + rnd[i * 3 + 2] * 7
        tx, ty = math.cos(angle) * speed * 9, math.sin(angle) * speed * 9
        sparks.append(
            '<g class="spark" style="--tx:%.0fpx; --ty:%.0fpx;">'
            '<rect x="-1.6" y="%.0f" width="3.2" height="%.0f" rx="1.6" fill="#fff3c4" '
            'transform="rotate(%.0f)"/></g>' % (tx, ty, -length, length, math.degrees(angle) + 90))

    red_shards = []
    for i in range(9):
        # deflect mostly upward and outward — the strike is thrown back off the shield
        angle = math.radians(-90 + (rnd[40 + i * 3] - 0.5) * 190)
        speed = 10 + rnd[40 + i * 3 + 1] * 8
        size = 7 + rnd[40 + i * 3 + 2] * 8
        tx, ty = math.cos(angle) * speed * 10, math.sin(angle) * speed * 10
        pts = "%.0f,0 %.0f,%.0f %.0f,%.0f" % (size, -size * 0.42, size * 0.34, -size * 0.42, -size * 0.34)
        red_shards.append(
            '<g class="rshard" style="--tx:%.0fpx; --ty:%.0fpx;">'
            '<polygon points="%s" fill="#e23046" transform="rotate(%.0f)"/></g>'
            % (tx, ty, pts, math.degrees(angle)))

    label = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 44)),
        (HIT, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 44)),
        (HIT + 2, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.16);" % (CX, CH - 44)),
        (HIT + 4, "transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 44)),
        (86, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 44)),
        (94, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.2);" % (CX, CH - 44)),
        (100, "opacity: 0;"),
    ]

    style = "\n".join([
        "text { %s }" % FONT,
        ".bolt { opacity: 0; animation: bolt %ss ease-in infinite; }" % DUR,
        ".shield { opacity: 0; animation: shield %ss cubic-bezier(0.4,0,0.2,1) infinite; }" % DUR,
        ".clang { opacity: 0; animation: clang %ss ease-out infinite; }" % DUR,
        ".cring { opacity: 0; fill: none; stroke: #fff4d0; animation: cring %ss ease-out infinite; }" % DUR,
        ".spark { opacity: 0; transform: translate(0,0); animation: burst %ss ease-out infinite; }" % DUR,
        ".rshard { opacity: 0; transform: translate(0,0); animation: burst %ss ease-out infinite; }" % DUR,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % DUR,
        keyframes("bolt", bolt),
        keyframes("shield", shield),
        keyframes("clang", clang),
        keyframes("cring", ring),
        keyframes("burst", burst),
        keyframes("lbl", label),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .bolt, .clang, .spark, .rshard { animation: none; opacity: 0; }\n"
        "  .shield { animation: none; opacity: 1; transform: %s scale(1) rotate(0deg); }\n"
        "  .cring { animation: none; opacity: 0.4; transform: %s scale(1.3); }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}"
        % (base, base, CX, CH - 44),
    ])

    defs = (
        '<radialGradient id="bg" cx="50%" cy="46%" r="82%">'
        '<stop offset="0%" stop-color="#171320" stop-opacity="1"/>'
        '<stop offset="100%" stop-color="#0b0910" stop-opacity="1"/></radialGradient>'
        '<radialGradient id="sheen" cx="34%" cy="28%" r="72%">'
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>'
        '<stop offset="45%" stop-color="#ffffff" stop-opacity="0.08"/>'
        '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
        '<radialGradient id="clg" cx="50%" cy="50%" r="50%">'
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>'
        '<stop offset="55%" stop-color="#dfe9ff" stop-opacity="0.75"/>'
        '<stop offset="100%" stop-color="#8fbcff" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="blt" x1="0%" y1="0%" x2="0%" y2="100%">'
        '<stop offset="0%" stop-color="#ff8a8a" stop-opacity="0.2"/>'
        '<stop offset="60%" stop-color="#ff3b3b" stop-opacity="0.95"/>'
        '<stop offset="100%" stop-color="#ffe08a" stop-opacity="1"/></linearGradient>')

    bolt_shape = ('<path class="bolt" d="M0,0 L-17,-34 L-6,-34 L-13,-104 L0,-56 L13,-104 L6,-34 L17,-34 Z" '
                  'fill="url(#blt)"/>')

    body = (
        '%s'                                                             # incoming bolt
        '<g class="shield">%s</g>'                                      # the shield
        '<circle class="clang" r="70" fill="url(#clg)"/>'              # CLANG flash
        '<circle class="cring" r="52"/>'                               # expanding ring
        '%s%s'                                                          # sparks + red shards (at centre)
        '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        'font-size="50" fill="#9cc4ff">BLOCKED!</text>'
    ) % (
        bolt_shape,
        shield_art(),
        '<g transform="translate(%d %d)">%s</g>' % (CX, CY, "".join(sparks)),
        '<g transform="translate(%d %d)">%s</g>' % (CX, CY, "".join(red_shards)),
    )

    aria = ("Animated mock of the shield-block effect: an incoming red Master Strike bolt drives down "
            "toward the board, Captain America's shield spins in and intercepts it with a bright "
            "metallic clang, sparks and red shards ricochet away harmlessly, and the word BLOCKED! "
            "pops on-screen. Loops.")
    title = "Proposed shield-block effect — Captain America's shield intercepts a Master Strike"

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
        '  %s\n'
        '</svg>\n'
    ) % (CW, CH, CW, CH, aria, title, style, defs, CW, CH, body)


if __name__ == "__main__":
    svg = build()
    with open("block-shield.svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    print("%-32s %6d bytes" % ("block-shield.svg", len(svg)))
