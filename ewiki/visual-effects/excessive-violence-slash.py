"""
Generate the animated-SVG mock for the SHIPPED "Excessive Violence" fire effect
(Visual Effects Framework wiki page, #surface-excessive-violence) — a Fight
"using Excessive Violence" firing its enrolled Excessive Violence abilities (the
Venomverse fight-overspend signature mechanic): two crossed swords swing in, a
crimson slash flash bursts, steel-and-crimson slash streaks fan outward along the
blade axes, and an EXCESSIVE VIOLENCE! call-out pops.

The violent counterpart of transform-surge.py: where the transform ASCENDS (a
hero powering up, gamma-green), this one CUTS (an overspend unleashed,
crimson/steel). Same card-less, vector-only, CSS-only-so-it-animates-on-the-
JS-free-ewiki-via-<img> approach, loops, and honours
@media (prefers-reduced-motion: reduce) by holding a single static frame (the
crossed swords shown, EXCESSIVE VIOLENCE! shown, no motion).

The crimson/steel palette is the shipped one from
apps/arena-client/src/vfx/excessiveViolenceVfxManifest.ts
(EXCESSIVE_VIOLENCE_VFX.colors = ['#b3122b', '#6e7b8b', '#d7dde3']).

Deterministic: streak layout is seeded; no runtime randomness.

This is a SHIPPED effect (WP-746 / D-24569) — the mock is illustrative of the
live beat (crossed-swords slash-burst + word), not a proposal.

Output: excessive-violence-slash.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")

CW, CH = 460, 340
CX, CY = CW / 2, CH / 2 - 6    # nudge the swords up a touch, leaving room for the word
DUR = 3.0
SLASH = 36.0                   # percent of the loop when the slash lands

# Crimson/steel palette (shipped, excessiveViolenceVfxManifest.ts).
CRIMSON = "#b3122b"
STEEL = "#6e7b8b"
EDGE = "#d7dde3"


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


def sword(angle_deg):
    """A stylised sword pointing up along its local +Y-up axis, rotated by
    angle_deg — a steel blade, a crimson guard, and a wrapped hilt. Drawn at the
    local origin so the crossed pair pivots about the centre."""
    return (
        '<g transform="rotate(%.1f)">'
        # blade — a long steel lozenge with a light edge
        '<polygon points="0,-96 7,-78 5,44 -5,44 -7,-78" fill="%s"/>'
        '<polygon points="0,-96 3,-78 2,44 -2,44 -3,-78" fill="%s"/>'
        # guard — a crimson crossbar
        '<rect x="-20" y="44" width="40" height="9" rx="3" fill="%s"/>'
        # grip + pommel
        '<rect x="-4.5" y="53" width="9" height="26" rx="3" fill="#2b3138"/>'
        '<circle cx="0" cy="83" r="6.5" fill="%s"/>'
        '</g>'
    ) % (angle_deg, STEEL, EDGE, CRIMSON, CRIMSON)


def build():
    base = "translate(%dpx,%dpx)" % (CX, CY)

    # The crimson aura behind the swords: it swells during the wind-up, pulses
    # hard on the slash, then fades.
    aura = [
        (0, "opacity: 0; transform: %s scale(0.5);" % base),
        (SLASH - 6, "opacity: 0.26; transform: %s scale(0.9);" % base),
        (SLASH, "opacity: 0.85; transform: %s scale(1.28);" % base),
        (SLASH + 10, "opacity: 0.38; transform: %s scale(1.05);" % base),
        (88, "opacity: 0.38; transform: %s scale(1.05);" % base),
        (96, "opacity: 0; transform: %s scale(0.7);" % base),
        (100, "opacity: 0; transform: %s scale(0.5);" % base),
    ]

    # The crossed swords: wind up (rotate + grow), snap through the slash with a
    # scale-punch, hold crossed, then fade.
    swords = [
        (0, "opacity: 0; transform: %s scale(0.5) rotate(-18deg);" % base),
        (SLASH - 4, "opacity: 0.85; transform: %s scale(0.9) rotate(-8deg);" % base),
        (SLASH, "opacity: 1; transform: %s scale(1.16) rotate(4deg);" % base),
        (SLASH + 4, "opacity: 1; transform: %s scale(0.98) rotate(0deg);" % base),
        (SLASH + 8, "opacity: 1; transform: %s scale(1.0) rotate(0deg);" % base),
        (90, "opacity: 1; transform: %s scale(1.0) rotate(0deg);" % base),
        (97, "opacity: 0; transform: %s scale(1.06) rotate(0deg);" % base),
        (100, "opacity: 0; transform: %s scale(0.5) rotate(0deg);" % base),
    ]

    # The bright crimson flash bloom on the slash.
    flash = [
        (0, "opacity: 0; transform: %s scale(0);" % base),
        (SLASH, "opacity: 0; transform: %s scale(0.3);" % base),
        (SLASH + 1.5, "opacity: 0.9; transform: %s scale(0.8);" % base),
        (SLASH + 16, "opacity: 0; transform: %s scale(2.0);" % base),
        (100, "opacity: 0; transform: %s scale(2.0);" % base),
    ]
    ring = [
        (0, "opacity: 0; transform: %s scale(0.15); stroke-width: 7;" % base),
        (SLASH, "opacity: 0; transform: %s scale(0.2); stroke-width: 7;" % base),
        (SLASH + 1, "opacity: 0.85;"),
        (SLASH + 24, "opacity: 0; transform: %s scale(2.0); stroke-width: 1;" % base),
        (100, "opacity: 0; transform: %s scale(2.0); stroke-width: 1;" % base),
    ]

    # Slash streaks radiating off the strike, biased along the two diagonal blade
    # axes (a crossed-swords cut, not a flat scatter).
    burst = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (SLASH, "opacity: 0; transform: translate(0,0);"),
        (SLASH + 2, "opacity: 1;"),
        (SLASH + 24, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    rnd = seeded(2015, 120)   # why: 2015 — Marvel's Venomverse-era Deadpool's Secret Secret Wars debut window; a fixed seed
    streaks = []
    # why: two diagonal blade axes (the crossed X: -45deg and +45deg), spraying
    # both ways along each, so the burst reads as a slash, not a radial pop.
    axes = [-45, 45, 135, -135]
    for i in range(16):
        axis = axes[i % 4]
        angle = math.radians(axis + (rnd[i * 3] - 0.5) * 44)
        speed = 9 + rnd[i * 3 + 1] * 8
        length = 8 + rnd[i * 3 + 2] * 9
        tx, ty = math.cos(angle) * speed * 9, math.sin(angle) * speed * 9
        colour = EDGE if (i % 3 == 0) else (CRIMSON if (i % 3 == 1) else STEEL)
        streaks.append(
            '<g class="spark" style="--tx:%.0fpx; --ty:%.0fpx;">'
            '<rect x="-1.8" y="%.0f" width="3.6" height="%.0f" rx="1.8" fill="%s" '
            'transform="rotate(%.0f)"/></g>'
            % (tx, ty, -length, length, colour, math.degrees(angle) + 90))

    label = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 40)),
        (SLASH, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 40)),
        (SLASH + 2, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.16);" % (CX, CH - 40)),
        (SLASH + 4, "transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 40)),
        (88, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 40)),
        (95, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.2);" % (CX, CH - 40)),
        (100, "opacity: 0;"),
    ]

    style = "\n".join([
        "text { %s }" % FONT,
        ".aura { opacity: 0; animation: aura %ss ease-out infinite; }" % DUR,
        ".swords { opacity: 0; animation: swords %ss cubic-bezier(0.3,0,0.2,1) infinite; }" % DUR,
        ".flash { opacity: 0; animation: flash %ss ease-out infinite; }" % DUR,
        ".fring { opacity: 0; fill: none; stroke: %s; animation: fring %ss ease-out infinite; }" % (CRIMSON, DUR),
        ".spark { opacity: 0; transform: translate(0,0); animation: burst %ss ease-out infinite; }" % DUR,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % DUR,
        keyframes("aura", aura),
        keyframes("swords", swords),
        keyframes("flash", flash),
        keyframes("fring", ring),
        keyframes("burst", burst),
        keyframes("lbl", label),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .flash, .spark { animation: none; opacity: 0; }\n"
        "  .aura { animation: none; opacity: 0.38; transform: %s scale(1.05); }\n"
        "  .swords { animation: none; opacity: 1; transform: %s scale(1) rotate(0deg); }\n"
        "  .fring { animation: none; opacity: 0.35; transform: %s scale(1.4); }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}"
        % (base, base, base, CX, CH - 40),
    ])

    # why: f-string (not %-format) so the literal SVG percentages (cx="50%") do
    # not collide with format specifiers — only the crimson/steel colours interpolate.
    defs = (
        f'<radialGradient id="bg" cx="50%" cy="44%" r="82%">'
        f'<stop offset="0%" stop-color="#171012" stop-opacity="1"/>'
        f'<stop offset="100%" stop-color="#0b0708" stop-opacity="1"/></radialGradient>'
        f'<radialGradient id="aur" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="{CRIMSON}" stop-opacity="0.9"/>'
        f'<stop offset="55%" stop-color="{CRIMSON}" stop-opacity="0.32"/>'
        f'<stop offset="100%" stop-color="{CRIMSON}" stop-opacity="0"/></radialGradient>'
        f'<radialGradient id="fla" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>'
        f'<stop offset="45%" stop-color="{CRIMSON}" stop-opacity="0.8"/>'
        f'<stop offset="100%" stop-color="{CRIMSON}" stop-opacity="0"/></radialGradient>')

    crossed_swords = sword(-45) + sword(45)

    aura_radius = 150

    body = (
        '<ellipse class="aura" rx="%d" ry="%d" fill="url(#aur)"/>'          # crimson aura
        '<circle class="flash" r="88" fill="url(#fla)"/>'                 # slash flash
        '<circle class="fring" r="60"/>'                                  # expanding ring
        '<g class="swords">%s</g>'                                        # crossed swords
        '<g transform="translate(%d %d)">%s</g>'                          # slash streaks
        '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        'font-size="32" fill="%s">EXCESSIVE VIOLENCE!</text>'
    ) % (
        aura_radius, int(aura_radius * 0.92),
        crossed_swords,
        CX, CY, "".join(streaks),
        EDGE,
    )

    aria = ("Animated mock of the Excessive Violence fire effect: two crossed swords swing in, "
            "a crimson slash flash bursts, steel-and-crimson slash streaks fan outward, and the "
            "words EXCESSIVE VIOLENCE! pop on-screen. Loops.")
    title = "Shipped Excessive Violence fire effect — a Fight using Excessive Violence unleashes its abilities"

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
    with open("excessive-violence-slash.svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    print("%-32s %6d bytes" % ("excessive-violence-slash.svg", len(svg)))
