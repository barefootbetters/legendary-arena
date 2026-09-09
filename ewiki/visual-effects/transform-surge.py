"""
Generate the animated-SVG mock for the SHIPPED "transform" power-surge effect
(Visual Effects Framework wiki page, #surface-transform) — a Hero base card
meeting its Transform condition and swapping into its stronger second form (the
World War Hulk signature mechanic): an energy charge gathers, a gamma-green
surge blooms, the base card powers up into a brighter transformed card, green
sparks ricochet upward, and a TRANSFORMED! call-out pops.

The positive twin of block-shield.py: where the shield INTERCEPTS a threat
(defensive, metallic), this one ASCENDS (a hero powering up, gamma-green). Same
card-less, vector-only, CSS-only-so-it-animates-on-the-JS-free-ewiki-via-<img>
approach, loops, and honours @media (prefers-reduced-motion: reduce) by holding
a single static frame (the transformed card shown, TRANSFORMED! shown, no motion).

The gamma palette is the shipped one from
apps/arena-client/src/vfx/transformVfxManifest.ts
(TRANSFORM_VFX.colors = ['#5ee66b', '#a6ff7a', '#eaffd0']).

Deterministic: spark layout is seeded; no runtime randomness.

This is a SHIPPED effect (WP-672 / D-24486) — the mock is illustrative of the
live beat (gamma surge bloom + burst + word), not a proposal.

Output: transform-surge.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")

CW, CH = 460, 340
CX, CY = CW / 2, CH / 2 - 6    # nudge the card up a touch, leaving room for the word
DUR = 3.0
SURGE = 36.0                    # percent of the loop when the transform lands

# Gamma palette (shipped, transformVfxManifest.ts).
GAMMA_CORE = "#5ee66b"
GAMMA_MID = "#a6ff7a"
GAMMA_EDGE = "#eaffd0"

CARD_W, CARD_H = 116, 162       # a hero-card aspect (~5:7)


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


def chevron(width, height, y_offset, fill):
    """An upward-pointing double chevron — the 'powered up / stronger' glyph."""
    parts = []
    for row in range(2):
        top = y_offset + row * (height * 0.62)
        parts.append(
            '<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>'
            % (
                0.0, top,
                width * 0.5, top + height * 0.5,
                width * 0.5, top + height * 0.5 + height * 0.22,
                0.0, top + height * 0.22,
                -width * 0.5, top + height * 0.5 + height * 0.22,
                -width * 0.5, top + height * 0.5,
                fill,
            )
        )
    return "".join(parts)


def card_art(body_fill, border, header_fill, emblem_fill, glow):
    """A stylised Hero card centred at the local origin: a rounded rect with a
    header band, a chevron emblem, and (for the transformed form) a gamma glow."""
    half_w, half_h = CARD_W / 2, CARD_H / 2
    parts = []
    if glow:
        parts.append(
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="16" fill="none" '
            'stroke="%s" stroke-width="6" opacity="0.55"/>'
            % (-half_w - 6, -half_h - 6, CARD_W + 12, CARD_H + 12, GAMMA_MID))
    parts.append(
        '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="12" fill="%s" '
        'stroke="%s" stroke-width="3"/>'
        % (-half_w, -half_h, CARD_W, CARD_H, body_fill, border))
    # header band
    parts.append(
        '<rect x="%.1f" y="%.1f" width="%.1f" height="26" rx="6" fill="%s"/>'
        % (-half_w + 8, -half_h + 8, CARD_W - 16, header_fill))
    # chevron emblem, centred in the card body
    parts.append('<g transform="translate(0 %.1f)">%s</g>'
                 % (10, chevron(44, 26, -20, emblem_fill)))
    return "".join(parts)


def build():
    base = "translate(%dpx,%dpx)" % (CX, CY)

    # The gamma aura behind the card: it swells during the charge, pulses hard on
    # the surge, then settles under the transformed card.
    aura = [
        (0, "opacity: 0; transform: %s scale(0.5);" % base),
        (SURGE - 6, "opacity: 0.28; transform: %s scale(0.9);" % base),
        (SURGE, "opacity: 0.85; transform: %s scale(1.25);" % base),
        (SURGE + 10, "opacity: 0.4; transform: %s scale(1.05);" % base),
        (88, "opacity: 0.4; transform: %s scale(1.05);" % base),
        (96, "opacity: 0; transform: %s scale(0.7);" % base),
        (100, "opacity: 0; transform: %s scale(0.5);" % base),
    ]

    # The base card: sits, breathes with the charge, then shrinks + fades as the
    # transformed form rises through it (the swap).
    card_base = [
        (0, "opacity: 1; transform: %s scale(0.92);" % base),
        (SURGE - 4, "opacity: 1; transform: %s scale(0.98);" % base),
        (SURGE, "opacity: 0.6; transform: %s scale(0.86);" % base),
        (SURGE + 5, "opacity: 0; transform: %s scale(0.72);" % base),
        (100, "opacity: 0; transform: %s scale(0.72);" % base),
    ]

    # The transformed card: hidden until the surge, then a scale-punch in and hold.
    card_xform = [
        (0, "opacity: 0; transform: %s scale(0.5);" % base),
        (SURGE - 2, "opacity: 0; transform: %s scale(0.6);" % base),
        (SURGE, "opacity: 1; transform: %s scale(1.14);" % base),
        (SURGE + 4, "opacity: 1; transform: %s scale(0.98);" % base),
        (SURGE + 8, "opacity: 1; transform: %s scale(1.0);" % base),
        (90, "opacity: 1; transform: %s scale(1.0);" % base),
        (97, "opacity: 0; transform: %s scale(1.06);" % base),
        (100, "opacity: 0; transform: %s scale(0.5);" % base),
    ]

    # The bright gamma flash bloom on the surge.
    flash = [
        (0, "opacity: 0; transform: %s scale(0);" % base),
        (SURGE, "opacity: 0; transform: %s scale(0.3);" % base),
        (SURGE + 1.5, "opacity: 0.9; transform: %s scale(0.8);" % base),
        (SURGE + 16, "opacity: 0; transform: %s scale(2.0);" % base),
        (100, "opacity: 0; transform: %s scale(2.0);" % base),
    ]
    ring = [
        (0, "opacity: 0; transform: %s scale(0.15); stroke-width: 7;" % base),
        (SURGE, "opacity: 0; transform: %s scale(0.2); stroke-width: 7;" % base),
        (SURGE + 1, "opacity: 0.85;"),
        (SURGE + 24, "opacity: 0; transform: %s scale(2.0); stroke-width: 1;" % base),
        (100, "opacity: 0; transform: %s scale(2.0); stroke-width: 1;" % base),
    ]

    # Gamma sparks radiating off the surge, biased UPWARD (the power-up rises).
    burst = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (SURGE, "opacity: 0; transform: translate(0,0);"),
        (SURGE + 2, "opacity: 1;"),
        (SURGE + 24, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    rnd = seeded(1962, 120)   # why: 1962 — the Incredible Hulk's debut year, a fixed seed
    sparks = []
    for i in range(16):
        # why: bias the spray upward (-90deg) so the burst reads as a rising
        # power-up, not a flat scatter — the transform ascends.
        angle = math.radians(-90 + (rnd[i * 3] - 0.5) * 300)
        speed = 9 + rnd[i * 3 + 1] * 8
        length = 8 + rnd[i * 3 + 2] * 8
        tx, ty = math.cos(angle) * speed * 9, math.sin(angle) * speed * 9
        colour = GAMMA_EDGE if (i % 3 == 0) else GAMMA_MID
        sparks.append(
            '<g class="spark" style="--tx:%.0fpx; --ty:%.0fpx;">'
            '<rect x="-1.7" y="%.0f" width="3.4" height="%.0f" rx="1.7" fill="%s" '
            'transform="rotate(%.0f)"/></g>'
            % (tx, ty, -length, length, colour, math.degrees(angle) + 90))

    label = [
        (0, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 40)),
        (SURGE, "opacity: 0; transform: translate(%dpx,%dpx) scale(0.4);" % (CX, CH - 40)),
        (SURGE + 2, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.16);" % (CX, CH - 40)),
        (SURGE + 4, "transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 40)),
        (88, "opacity: 1; transform: translate(%dpx,%dpx) scale(1.0);" % (CX, CH - 40)),
        (95, "opacity: 0; transform: translate(%dpx,%dpx) scale(1.2);" % (CX, CH - 40)),
        (100, "opacity: 0;"),
    ]

    style = "\n".join([
        "text { %s }" % FONT,
        ".aura { opacity: 0; animation: aura %ss ease-out infinite; }" % DUR,
        ".cbase { opacity: 0; animation: cbase %ss ease-in infinite; }" % DUR,
        ".cxform { opacity: 0; animation: cxform %ss cubic-bezier(0.3,0,0.2,1) infinite; }" % DUR,
        ".flash { opacity: 0; animation: flash %ss ease-out infinite; }" % DUR,
        ".fring { opacity: 0; fill: none; stroke: %s; animation: fring %ss ease-out infinite; }" % (GAMMA_EDGE, DUR),
        ".spark { opacity: 0; transform: translate(0,0); animation: burst %ss ease-out infinite; }" % DUR,
        ".lbl { opacity: 0; animation: lbl %ss ease-out infinite; }" % DUR,
        keyframes("aura", aura),
        keyframes("cbase", card_base),
        keyframes("cxform", card_xform),
        keyframes("flash", flash),
        keyframes("fring", ring),
        keyframes("burst", burst),
        keyframes("lbl", label),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .cbase, .flash, .spark { animation: none; opacity: 0; }\n"
        "  .aura { animation: none; opacity: 0.4; transform: %s scale(1.05); }\n"
        "  .cxform { animation: none; opacity: 1; transform: %s scale(1); }\n"
        "  .fring { animation: none; opacity: 0.35; transform: %s scale(1.4); }\n"
        "  .lbl { animation: none; opacity: 1; transform: translate(%dpx,%dpx) scale(1); }\n}"
        % (base, base, base, CX, CH - 40),
    ])

    # why: f-string (not %-format) so the literal SVG percentages (cx="50%") do
    # not collide with format specifiers — only the gamma colours interpolate.
    defs = (
        f'<radialGradient id="bg" cx="50%" cy="44%" r="82%">'
        f'<stop offset="0%" stop-color="#131a12" stop-opacity="1"/>'
        f'<stop offset="100%" stop-color="#0a0d09" stop-opacity="1"/></radialGradient>'
        f'<radialGradient id="aur" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="{GAMMA_MID}" stop-opacity="0.9"/>'
        f'<stop offset="55%" stop-color="{GAMMA_CORE}" stop-opacity="0.35"/>'
        f'<stop offset="100%" stop-color="{GAMMA_CORE}" stop-opacity="0"/></radialGradient>'
        f'<radialGradient id="fla" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>'
        f'<stop offset="45%" stop-color="{GAMMA_MID}" stop-opacity="0.8"/>'
        f'<stop offset="100%" stop-color="{GAMMA_CORE}" stop-opacity="0"/></radialGradient>')

    base_card = card_art("#33414f", "#5a6b7b", "#485a6b", "#8ea3b6", glow=False)
    xform_card = card_art("#1f3a24", GAMMA_CORE, "#2c5a34", GAMMA_MID, glow=True)

    aura_radius = int(max(CARD_W, CARD_H) * 0.95)

    body = (
        '<ellipse class="aura" rx="%d" ry="%d" fill="url(#aur)"/>'          # gamma aura
        '<g class="cbase">%s</g>'                                          # base card
        '<circle class="flash" r="88" fill="url(#fla)"/>'                 # surge flash
        '<circle class="fring" r="60"/>'                                  # expanding ring
        '<g class="cxform">%s</g>'                                        # transformed card
        '<g transform="translate(%d %d)">%s</g>'                          # sparks
        '<text class="lbl" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        'font-size="38" fill="%s">TRANSFORMED!</text>'
    ) % (
        aura_radius, int(aura_radius * 0.92),
        base_card,
        xform_card,
        CX, CY, "".join(sparks),
        GAMMA_MID,
    )

    aria = ("Animated mock of the transform power-surge effect: a Hero base card charges with "
            "gamma energy, a green surge blooms, the card powers up into a brighter transformed "
            "card, green sparks ricochet upward, and the word TRANSFORMED! pops on-screen. Loops.")
    title = "Shipped transform power-surge effect — a Hero card swaps into its stronger second form"

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
    with open("transform-surge.svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    print("%-32s %6d bytes" % ("transform-surge.svg", len(svg)))
