"""
Generate the animated-SVG mock for the SHIPPED villain slash (Visual Effects
Framework wiki page, #surface-villain-slash) — the Fruit Ninja-style beat that
plays on every villain or henchman defeat in the City: a bright blade streak
crosses the card, the card splits along the cut into two halves that hop and
tumble away under gravity, a villain-purple droplet spray flies along the cut,
stains fade from the mat, and (on a quick second defeat) DOUBLE TAKEDOWN! pops.

Same card-less-art, vector-only, CSS-only approach as
excessive-violence-slash.py, so it animates on the JS-free ewiki via <img>. It
loops, and honours @media (prefers-reduced-motion: reduce) by holding one static
frame (the split card, the stains, and the word — no motion).

The palette and angle are the shipped ones from
apps/arena-client/src/vfx/villainSlashVfxManifest.ts
(VILLAIN_SLASH_VFX.colors = ['#7b1fa2', '#4a0d67', '#b44fd6'], streak core
#ffffff / glow #d6c2ff, first angle -28deg). The halves are cut with the same
through-the-centre half-plane split as villainSlashGeometry.ts.

Deterministic: droplet and stain layout is seeded; no runtime randomness.

This is a SHIPPED effect (WP-755 / D-24584) — the mock is illustrative of the
live beat (which slices the real card art), not a proposal.

Output: villain-slash.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")

CW, CH = 460, 340
CARD_W, CARD_H = 120, 168                 # the CardTile 5:7 ratio
CX, CY = CW / 2, CH / 2 - 14              # card centre, leaving room for the word
DUR = 3.2
CUT = 22.0                                # percent of the loop when the blade lands
ANGLE = -28                               # VILLAIN_SLASH_VFX.angles[0], screen convention

# Villain-ink palette + streak colours (shipped, villainSlashVfxManifest.ts).
VILLAIN = "#7b1fa2"
VILLAIN_DEEP = "#4a0d67"
VILLAIN_BRIGHT = "#b44fd6"
STREAK_CORE = "#ffffff"
STREAK_GLOW = "#d6c2ff"


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


def split_card(width, height, angle_deg):
    """The same half-plane split as villainSlashGeometry.splitCardAlongCut: the
    card rectangle cut through its centre at angle_deg (screen convention)."""
    radians = math.radians(angle_deg)
    normal_x, normal_y = -math.sin(radians), math.cos(radians)
    corners = [(0, 0), (width, 0), (width, height), (0, height)]
    distances = [(x - width / 2) * normal_x + (y - height / 2) * normal_y for x, y in corners]
    halves = []
    for keep in (-1, 1):
        polygon = []
        for i, (x, y) in enumerate(corners):
            j = (i + 1) % 4
            current, following = distances[i] * keep, distances[j] * keep
            if current >= 0:
                polygon.append((x, y))
            if (current > 0 > following) or (current < 0 < following):
                fraction = current / (current - following)
                nx, ny = corners[j]
                polygon.append((x + (nx - x) * fraction, y + (ny - y) * fraction))
        halves.append(polygon)
    return halves, (normal_x, normal_y)


def card_art():
    """A stylised villain card (the live beat slices the REAL card art)."""
    return (
        '<rect x="0" y="0" width="%d" height="%d" rx="8" fill="url(#cardbg)"/>'
        '<rect x="4" y="4" width="%d" height="%d" rx="6" fill="none" stroke="%s" stroke-width="2"/>'
        # a hooded villain silhouette
        '<circle cx="%d" cy="62" r="22" fill="#1a0726"/>'
        '<path d="M %d 58 q 22 -34 44 0 l 0 10 q -22 -8 -44 0 z" fill="%s"/>'
        '<path d="M %d 150 q 42 -78 84 0 z" fill="#1a0726"/>'
        '<circle cx="%d" cy="64" r="3" fill="%s"/><circle cx="%d" cy="64" r="3" fill="%s"/>'
        # the name bar
        '<rect x="10" y="%d" width="%d" height="16" rx="3" fill="#12051b" opacity="0.85"/>'
        '<rect x="18" y="%d" width="%d" height="4" rx="2" fill="%s"/>'
    ) % (
        CARD_W, CARD_H,
        CARD_W - 8, CARD_H - 8, VILLAIN_BRIGHT,
        CARD_W / 2,
        CARD_W / 2 - 22, VILLAIN,
        CARD_W / 2 - 42,
        CARD_W / 2 - 8, VILLAIN_BRIGHT, CARD_W / 2 + 8, VILLAIN_BRIGHT,
        CARD_H - 28, CARD_W - 20,
        CARD_H - 22, CARD_W - 36, VILLAIN_BRIGHT,
    )


def build():
    halves, (normal_x, normal_y) = split_card(CARD_W, CARD_H, ANGLE)
    origin_x, origin_y = CX - CARD_W / 2, CY - CARD_H / 2
    base = "translate(%.1fpx,%.1fpx)" % (origin_x, origin_y)

    # Each half: whole until the cut, then pushed apart along the normal, a short
    # upward hop, a gravity fall, a tumble, and a fade — mirroring buildHalfKeyframes.
    def half_stops(side):
        stops = [(0, "opacity: 1; transform: %s translate(0px,0px) rotate(0deg);" % base),
                 (CUT, "opacity: 1; transform: %s translate(0px,0px) rotate(0deg);" % base)]
        flight = 30.0
        for step in range(1, 11):
            progress = step / 10
            separation = 46 * (1 - (1 - progress) ** 2)
            offset_x = side * (separation * normal_x + 28 * progress)
            offset_y = side * separation * normal_y - 220 * progress + 560 * progress * progress
            opacity = 1 if progress <= 0.6 else 1 - (progress - 0.6) / 0.4
            stops.append((CUT + flight * progress,
                          "opacity: %.2f; transform: %s translate(%.1fpx,%.1fpx) rotate(%.1fdeg);"
                          % (opacity, base, offset_x, offset_y, side * 42 * progress)))
        stops.append((100, "opacity: 0; transform: %s translate(0px,0px) rotate(0deg);" % base))
        return stops

    # The whole card before the cut (the halves take over on the cut).
    whole = [(0, "opacity: 0;"), (6, "opacity: 1;"), (CUT, "opacity: 1;"),
             (CUT + 0.01, "opacity: 0;"), (100, "opacity: 0;")]

    streak = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) rotate(%ddeg) scaleX(0.1);" % (CX, CY, ANGLE)),
        (CUT - 3, "opacity: 0; transform: translate(%dpx,%dpx) rotate(%ddeg) scaleX(0.1);" % (CX, CY, ANGLE)),
        (CUT, "opacity: 1; transform: translate(%dpx,%dpx) rotate(%ddeg) scaleX(1);" % (CX, CY, ANGLE)),
        (CUT + 7, "opacity: 0; transform: translate(%dpx,%dpx) rotate(%ddeg) scaleX(1.06);" % (CX, CY, ANGLE)),
        (100, "opacity: 0;"),
    ]

    drops = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (CUT, "opacity: 0; transform: translate(0,0);"),
        (CUT + 1, "opacity: 1;"),
        (CUT + 26, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    stain = [
        (0, "opacity: 0;"), (CUT, "opacity: 0;"), (CUT + 2, "opacity: 0.8;"),
        (70, "opacity: 0.6;"), (92, "opacity: 0;"), (100, "opacity: 0;"),
    ]

    label = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.5);" % (CX, CH - 30)),
        (CUT + 4, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.5);" % (CX, CH - 30)),
        (CUT + 7, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.14);" % (CX, CH - 30)),
        (CUT + 10, "transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 30)),
        (86, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 30)),
        (94, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.1);" % (CX, CH - 30)),
        (100, "opacity: 0;"),
    ]

    rnd = seeded(1963, 80)   # why: 1963 — a fixed seed (the year the Marvel villain line-up took shape)
    radians = math.radians(ANGLE)
    drops_svg = []
    for i in range(18):
        # why: droplets fly ALONG the cut, both ways, with a little spread — the
        # confetti spray in the live beat uses the same cut angle.
        direction = 0 if i % 2 == 0 else math.pi
        spread = (rnd[i * 3] - 0.5) * 0.7
        speed = 70 + rnd[i * 3 + 1] * 90
        tx = math.cos(radians + direction + spread) * speed
        ty = math.sin(radians + direction + spread) * speed + 30 * rnd[i * 3 + 2]
        colour = (VILLAIN, VILLAIN_DEEP, VILLAIN_BRIGHT)[i % 3]
        drops_svg.append('<circle class="drop" r="%.1f" fill="%s" style="--tx:%.0fpx; --ty:%.0fpx;"/>'
                         % (2 + rnd[i * 3 + 2] * 2.5, colour, tx, ty))

    stains_svg = []
    for i in range(5):
        along = ((i + 0.5) / 5 - 0.5) * 2 * 64 * 0.85
        wobble = ((1963 * 7 + i * 13) % 5 - 2) * 4
        sx = CX + along * math.cos(radians) - wobble * math.sin(radians)
        sy = CY + along * math.sin(radians) + wobble * math.cos(radians)
        stains_svg.append('<circle class="stain" cx="%.1f" cy="%.1f" r="%.1f" fill="url(#ink)"/>'
                          % (sx, sy, 8 + ((1963 * 3 + i * 5) % 5) * 1.6))

    style_lines = [
        "text { %s }" % FONT,
        ".whole { opacity: 0; animation: whole %ss linear infinite; }" % DUR,
        ".halfa { opacity: 0; animation: halfa %ss linear infinite; }" % DUR,
        ".halfb { opacity: 0; animation: halfb %ss linear infinite; }" % DUR,
        ".streak { opacity: 0; animation: streak %ss ease-out infinite; }" % DUR,
        ".drop { opacity: 0; transform-box: fill-box; animation: drops %ss ease-out infinite; }" % DUR,
        ".stain { opacity: 0; animation: stain %ss ease-in infinite; }" % DUR,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % DUR,
        keyframes("whole", whole),
        keyframes("halfa", half_stops(-1)),
        keyframes("halfb", half_stops(1)),
        keyframes("streak", streak),
        keyframes("drops", drops),
        keyframes("stain", stain),
        keyframes("lbl", label),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .whole, .streak, .drop { animation: none; opacity: 0; }\n"
        "  .halfa { animation: none; opacity: 1; transform: %s translate(%.1fpx,%.1fpx); }\n"
        "  .halfb { animation: none; opacity: 1; transform: %s translate(%.1fpx,%.1fpx); }\n"
        "  .stain { animation: none; opacity: 0.7; }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}"
        % (base, -10 * normal_x, -10 * normal_y, base, 10 * normal_x, 10 * normal_y, CX, CH - 30),
    ]

    def points(polygon):
        return " ".join("%.1f,%.1f" % point for point in polygon)

    # why: f-string (not %-format) so the literal SVG percentages do not collide
    # with format specifiers — only the villain colours interpolate.
    defs = (
        f'<radialGradient id="bg" cx="50%" cy="44%" r="82%">'
        f'<stop offset="0%" stop-color="#150d1a"/><stop offset="100%" stop-color="#08060b"/></radialGradient>'
        f'<linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="#3a1450"/><stop offset="100%" stop-color="#1a0726"/></linearGradient>'
        f'<radialGradient id="ink" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="{VILLAIN_DEEP}"/><stop offset="60%" stop-color="{VILLAIN}" stop-opacity="0.9"/>'
        f'<stop offset="100%" stop-color="{VILLAIN}" stop-opacity="0"/></radialGradient>'
        f'<linearGradient id="blade" x1="0" y1="0" x2="1" y2="0">'
        f'<stop offset="0%" stop-color="{STREAK_GLOW}" stop-opacity="0"/>'
        f'<stop offset="25%" stop-color="{STREAK_GLOW}"/><stop offset="50%" stop-color="{STREAK_CORE}"/>'
        f'<stop offset="75%" stop-color="{STREAK_GLOW}"/>'
        f'<stop offset="100%" stop-color="{STREAK_GLOW}" stop-opacity="0"/></linearGradient>'
        f'<clipPath id="cuta"><polygon points="{points(halves[0])}"/></clipPath>'
        f'<clipPath id="cutb"><polygon points="{points(halves[1])}"/></clipPath>'
        f'<filter id="glow" x="-20%" y="-300%" width="140%" height="700%">'
        f'<feGaussianBlur stdDeviation="3"/></filter>'
    )

    art = card_art()
    streak_length = math.hypot(CARD_W, CARD_H) * 1.35
    body = (
        '%s'                                                              # stains (under the card)
        '<g class="whole" transform="translate(%.1f %.1f)">%s</g>'         # the card before the cut
        '<g class="halfa"><g clip-path="url(#cuta)">%s</g></g>'           # half one
        '<g class="halfb"><g clip-path="url(#cutb)">%s</g></g>'           # half two
        '<g class="streak"><rect x="%.1f" y="-4" width="%.1f" height="8" rx="4" fill="%s" '
        'filter="url(#glow)"/><rect x="%.1f" y="-2.5" width="%.1f" height="5" rx="2.5" fill="url(#blade)"/></g>'
        '<g transform="translate(%.1f %.1f)">%s</g>'                        # droplets
        '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        'font-size="30" fill="#ffe082">DOUBLE TAKEDOWN!</text>'
    ) % (
        "".join(stains_svg),
        origin_x, origin_y, art,
        art, art,
        -streak_length / 2, streak_length, STREAK_GLOW, -streak_length / 2, streak_length,
        CX, CY, "".join(drops_svg),
    )

    aria = ("Animated mock of the villain slash: a bright blade streak crosses a villain card, "
            "the card splits along the cut into two halves that hop and tumble away, purple "
            "droplets spray along the cut, stains fade, and the words DOUBLE TAKEDOWN! pop. Loops.")
    title = "Shipped villain slash — every villain or henchman defeat slices the card"

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
        '  %s\n'
        '</svg>\n'
    ) % (CW, CH, CW, CH, aria, title, "\n".join(style_lines), defs, CW, CH, body)


if __name__ == "__main__":
    svg = build()
    with open("villain-slash.svg", "w", encoding="utf-8", newline="\n") as handle:
        handle.write(svg)
    print("%-32s %6d bytes" % ("villain-slash.svg", len(svg)))
