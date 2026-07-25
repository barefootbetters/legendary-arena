"""
Generate animated-SVG demos for the Surface-1 notable-event 'suggested
visual characters' (Visual Effects Framework wiki page). One self-contained,
CSS-only animated SVG per event, each overlaying the effect on a themed card.

No JavaScript (animates on the JS-free ewiki via <img>); each honours
@media (prefers-reduced-motion: reduce). Cards are downscaled + re-encoded
webp, embedded as base64, so each file is self-contained and lean.

Deterministic: particle layouts are seeded; no runtime randomness.

Effects (event -> character, per the wiki table):
  mastermindStrikeResolved  screen-shake + red edge-vignette pulse + dark shards
  fightResolved             impact burst + coin/star flourish
  ambushResolved            hard card-slam drop-in + menacing green edge-glow
  schemeTwistResolved       slow desaturation ripple (darker, subtler)
  healResolved              soft green restorative shimmer rising off the card
"""

import base64
import io
import math
import os
import urllib.request
from PIL import Image

CARD_W = 360
MARGIN = 46

CARDS = {
    "strike":      "https://images.legendary-arena.com/ff04/ff04-mm-galactus.webp",
    "fight":       "https://images.legendary-arena.com/wwhk/wwhk-vi-sakaar-imperial-guard-lieutenant-caiera.webp",
    "ambush":      "https://images.legendary-arena.com/core/core-vi-spider-foes-green-goblin.webp",
    "schemetwist": "https://images.legendary-arena.com/core/core-st-scheme-twist.webp",
    "heal":        "https://images.legendary-arena.com/core/core-wd-wound.webp",
}


def load_card(key):
    """Downscale to CARD_W, re-encode webp, return (base64, w, h)."""
    local = os.path.join("cards", key + ".webp")
    if not os.path.exists(local):
        os.makedirs("cards", exist_ok=True)
        urllib.request.urlretrieve(CARDS[key], local)
    image = Image.open(local).convert("RGB")
    native_w, native_h = image.size
    target_h = round(CARD_W * native_h / native_w)
    image = image.resize((CARD_W, target_h), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=82, method=6)
    return base64.b64encode(buffer.getvalue()).decode("ascii"), CARD_W, target_h


def seeded(seed, count):
    """Deterministic pseudo-random floats in [0,1) — no runtime randomness."""
    values = []
    for _ in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        values.append(seed / 0x7FFFFFFF)
    return values


def keyframes(name, stops):
    """stops: list of (percent_float, declaration_string)."""
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def reduced(rules):
    return "@media (prefers-reduced-motion: reduce) {\n%s\n}" % "\n".join(
        "  " + rule for rule in rules
    )


def clip_def(card_h):
    return '<clipPath id="cc"><rect width="%d" height="%d" rx="7"/></clipPath>' % (CARD_W, card_h)


def card_image(b64, card_h):
    return ('<image href="data:image/webp;base64,%s" width="%d" height="%d" '
            'clip-path="url(#cc)"/>' % (b64, CARD_W, card_h))


def assemble(slug, title, aria, defs, style, body, card_h):
    canvas_w = CARD_W + MARGIN * 2
    canvas_h = card_h + MARGIN * 2
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="#0e0c12"/>\n'
        '  <g transform="translate(%d %d)">%s</g>\n'
        '</svg>\n'
    ) % (canvas_w, canvas_h, canvas_w, canvas_h, aria, title, style, defs,
         canvas_w, canvas_h, MARGIN, MARGIN, body)
    with open(slug + ".svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    return len(svg)


# ---------------------------------------------------------------------------
# mastermindStrikeResolved — screen-shake + red edge-vignette pulse + shards
# ---------------------------------------------------------------------------
def build_strike(b64, card_h):
    dur, frames, strike = 2.1, 46, 10
    ecx, ecy = CARD_W / 2, card_h / 2

    def shake_at(f):
        if f < strike:
            return (0.0, 0.0)
        amp = 15.0 * math.exp(-(f - strike) / 5.0)
        return (amp * math.sin((f - strike) * 2.7), amp * math.cos((f - strike) * 3.1))

    def env(f, tau):
        return 0.0 if f < strike else math.exp(-(f - strike) / tau)

    shake_stops, vig_stops = [], []
    for f in range(frames):
        pct = f / (frames - 1) * 100
        dx, dy = shake_at(f)
        shake_stops.append((pct, "transform: translate(%.1fpx, %.1fpx);" % (dx, dy)))
        v = min(env(f, 7.0) + 0.55 * env(f - 3, 7.0), 1.0)
        vig_stops.append((pct, "opacity: %.3f;" % v))

    strike_pct = strike / (frames - 1) * 100
    life = 16
    end_pct = (strike + life) / (frames - 1) * 100
    shard_stops = [
        (0, "opacity: 0; transform: translate(0, 0);"),
        (strike_pct, "opacity: 0; transform: translate(0, 0);"),
        (strike_pct + 1, "opacity: 0.9;"),
        (end_pct, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    rnd = seeded(1337, 64)
    nodes = []
    for i in range(16):
        angle = (i / 16) * 2 * math.pi + (rnd[i * 3] - 0.5) * 0.55
        speed = 9.0 + rnd[i * 3 + 1] * 7.0
        size = 8 + rnd[i * 3 + 2] * 10
        tx = math.cos(angle) * speed * 16
        ty = math.sin(angle) * speed * 16
        pts = "%.0f,0 %.0f,%.0f %.0f,%.0f" % (size, -size * 0.42, size * 0.32, -size * 0.42, -size * 0.32)
        nodes.append('<g class="shard" style="--tx:%.0fpx; --ty:%.0fpx;">'
                     '<polygon points="%s" fill="#12101a" transform="rotate(%.0f)"/></g>'
                     % (tx, ty, pts, math.degrees(angle)))

    style = "\n".join([
        ".shake { animation: shake %ss linear infinite; }" % dur,
        ".vig { opacity: 0; animation: vig %ss linear infinite; }" % dur,
        ".shard { opacity: 0; transform: translate(0,0); animation: shard %ss ease-out infinite; }" % dur,
        keyframes("shake", shake_stops),
        keyframes("vig", vig_stops),
        keyframes("shard", shard_stops),
        reduced([".shake { animation: none; }",
                 ".vig { animation: none; opacity: 0.55; }",
                 ".shard { animation: none; opacity: 0; }"]),
    ])
    defs = (clip_def(card_h) +
            '<radialGradient id="vg" cx="50%" cy="50%" r="72%">'
            '<stop offset="46%" stop-color="#cd1218" stop-opacity="0"/>'
            '<stop offset="100%" stop-color="#cd1218" stop-opacity="0.95"/></radialGradient>')
    body = ('<g class="shake">%s'
            '<rect class="vig" width="%d" height="%d" rx="7" fill="url(#vg)"/>'
            '<g transform="translate(%.0f %.0f)">%s</g></g>'
            % (card_image(b64, card_h), CARD_W, card_h, ecx, ecy, "".join(nodes)))
    return ("Surface-1 mastermindStrikeResolved — the signature 'uh-oh' jolt",
            "Animated mock: a Mastermind card jolts with a screen-shake while a red vignette "
            "pulses in from the edges and dark shard particles burst outward, then settles. Loops.",
            defs, style, body)


# ---------------------------------------------------------------------------
# fightResolved — impact burst at the City space + coin/star flourish
# ---------------------------------------------------------------------------
def build_fight(b64, card_h):
    dur = 2.3
    ecx, ecy = CARD_W / 2, card_h / 2
    hit = 17.0  # percent of loop when the blow lands

    recoil = [
        (0, "transform: translate(0,0);"),
        (hit - 1, "transform: translate(0,0);"),
        (hit + 1, "transform: translate(0, 6px);"),
        (hit + 6, "transform: translate(0, -2px);"),
        (hit + 12, "transform: translate(0,0);"),
        (100, "transform: translate(0,0);"),
    ]
    flash = [
        (0, "opacity: 0; transform: scale(0);"),
        (hit, "opacity: 0; transform: scale(0.2);"),
        (hit + 2, "opacity: 0.95; transform: scale(0.5);"),
        (hit + 14, "opacity: 0; transform: scale(1.6);"),
        (100, "opacity: 0; transform: scale(1.6);"),
    ]
    ring = [
        (0, "opacity: 0; transform: scale(0.1); stroke-width: 6;"),
        (hit, "opacity: 0; transform: scale(0.1); stroke-width: 6;"),
        (hit + 1, "opacity: 0.85;"),
        (hit + 20, "opacity: 0; transform: scale(1.5); stroke-width: 1;"),
        (100, "opacity: 0; transform: scale(1.5); stroke-width: 1;"),
    ]
    coin = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (hit, "opacity: 0; transform: translate(0,0);"),
        (hit + 2, "opacity: 1;"),
        (85, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]

    rnd = seeded(4242, 40)
    coins = []
    for i in range(9):
        tx = (rnd[i * 3] - 0.5) * 150
        ty = -(120 + rnd[i * 3 + 1] * 70)
        radius = 5 + rnd[i * 3 + 2] * 3
        delay = -(i * 0.03)
        coins.append(
            '<g class="coin" style="--tx:%.0fpx; --ty:%.0fpx; animation-delay:%.2fs;">'
            '<circle r="%.1f" fill="#ffcf47"/><circle r="%.1f" cx="-%.1f" cy="-%.1f" fill="#fff4c2"/></g>'
            % (tx, ty, delay, radius, radius * 0.35, radius * 0.3, radius * 0.3))

    style = "\n".join([
        ".recoil { animation: recoil %ss ease-out infinite; }" % dur,
        ".flash { opacity: 0; animation: flash %ss ease-out infinite; }" % dur,
        ".ring { opacity: 0; fill: none; stroke: #ffdd6a; animation: ring %ss ease-out infinite; }" % dur,
        ".coin { opacity: 0; transform: translate(0,0); animation: coin %ss ease-out infinite; }" % dur,
        keyframes("recoil", recoil),
        keyframes("flash", flash),
        keyframes("ring", ring),
        keyframes("coin", coin),
        reduced([".recoil { animation: none; }",
                 ".flash { animation: none; opacity: 0; }",
                 ".ring { animation: none; opacity: 0.4; transform: scale(1); }",
                 ".coin { animation: none; opacity: 0; }"]),
    ])
    defs = (clip_def(card_h) +
            '<radialGradient id="fl" cx="50%" cy="50%" r="50%">'
            '<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="55%" stop-color="#ffe27a" stop-opacity="0.9"/>'
            '<stop offset="100%" stop-color="#ffb020" stop-opacity="0"/></radialGradient>')
    body = ('<g class="recoil">%s</g>'
            '<g transform="translate(%.0f %.0f)">'
            '<circle class="flash" r="46" fill="url(#fl)"/>'
            '<circle class="ring" r="30"/>%s</g>'
            % (card_image(b64, card_h), ecx, ecy, "".join(coins)))
    return ("Surface-1 fightResolved — impact burst + rescue flourish",
            "Animated mock: a villain card takes an impact burst — a white-gold flash and an "
            "expanding shockwave ring at the City space — while gold coins arc upward for a rescued "
            "bystander, then settles. Loops.",
            defs, style, body)


# ---------------------------------------------------------------------------
# ambushResolved — hard card-slam drop-in + menacing green edge-glow
# ---------------------------------------------------------------------------
def build_ambush(b64, card_h):
    dur = 2.6
    land = 22.0
    drop = [
        (0, "opacity: 0; transform: translate(0, -150px);"),
        (4, "opacity: 1; transform: translate(0, -150px);"),
        (land, "opacity: 1; transform: translate(0, 0);"),
        (land + 3, "transform: translate(0, -9px);"),
        (land + 7, "transform: translate(0, 0);"),
        (88, "opacity: 1; transform: translate(0, 0);"),
        (95, "opacity: 0; transform: translate(0, 0);"),
        (96, "opacity: 0; transform: translate(0, -150px);"),
        (100, "opacity: 0; transform: translate(0, -150px);"),
    ]
    slam = [
        (0, "transform: translate(0,0);"),
        (land, "transform: translate(0,0);"),
        (land + 1, "transform: translate(3px, 2px);"),
        (land + 3, "transform: translate(-3px, 1px);"),
        (land + 5, "transform: translate(2px, 0);"),
        (land + 8, "transform: translate(0,0);"),
        (100, "transform: translate(0,0);"),
    ]
    glow = [
        (0, "opacity: 0;"),
        (land, "opacity: 0;"),
        (land + 4, "opacity: 0.75;"),
        (45, "opacity: 0.30;"),
        (65, "opacity: 0.75;"),
        (85, "opacity: 0.25;"),
        (94, "opacity: 0;"),
        (100, "opacity: 0;"),
    ]
    dust = [
        (0, "opacity: 0; transform: scale(0.2);"),
        (land, "opacity: 0; transform: scale(0.2);"),
        (land + 2, "opacity: 0.6; transform: scale(0.5);"),
        (land + 12, "opacity: 0; transform: scale(1.4);"),
        (100, "opacity: 0; transform: scale(1.4);"),
    ]
    style = "\n".join([
        ".slam { animation: slam %ss ease-out infinite; }" % dur,
        ".drop { opacity: 0; animation: drop %ss cubic-bezier(0.5,0,0.75,0.3) infinite; }" % dur,
        ".glow { opacity: 0; animation: glow %ss ease-in-out infinite; }" % dur,
        ".dust { opacity: 0; fill: #b8a88a; animation: dust %ss ease-out infinite; }" % dur,
        keyframes("slam", slam),
        keyframes("drop", drop),
        keyframes("glow", glow),
        keyframes("dust", dust),
        reduced([".slam { animation: none; }",
                 ".drop { animation: none; opacity: 1; transform: translate(0,0); }",
                 ".glow { animation: none; opacity: 0.5; }",
                 ".dust { animation: none; opacity: 0; }"]),
    ])
    defs = (clip_def(card_h) +
            '<radialGradient id="gg" cx="50%" cy="50%" r="72%">'
            '<stop offset="52%" stop-color="#57e06a" stop-opacity="0"/>'
            '<stop offset="88%" stop-color="#57e06a" stop-opacity="0.55"/>'
            '<stop offset="100%" stop-color="#8a4dff" stop-opacity="0.85"/></radialGradient>')
    body = ('<g class="slam">'
            '<g class="drop">%s'
            '<rect class="glow" width="%d" height="%d" rx="7" fill="url(#gg)"/></g>'
            '<g transform="translate(%.0f %d)"><ellipse class="dust" rx="70" ry="14"/></g>'
            '</g>'
            % (card_image(b64, card_h), CARD_W, card_h, CARD_W / 2, card_h))
    return ("Surface-1 ambushResolved — hard slam-in + menacing edge-glow",
            "Animated mock: a villain card drops hard into its City space with an impact shake and "
            "a dust puff, then a sickly green-and-purple edge-glow pulses menacingly. Loops.",
            defs, style, body)


# ---------------------------------------------------------------------------
# schemeTwistResolved — slow desaturation ripple (darker, subtler)
# ---------------------------------------------------------------------------
def build_schemetwist(b64, card_h):
    dur = 3.2
    ecx, ecy = CARD_W / 2, card_h / 2
    wash = [
        (0, "opacity: 0;"),
        (12, "opacity: 0;"),
        (34, "opacity: 0.42;"),
        (70, "opacity: 0.12;"),
        (100, "opacity: 0;"),
    ]
    # three concentric rings, staggered via negative delay, slow ease-out
    ring = [
        (0, "opacity: 0; transform: scale(0.05);"),
        (8, "opacity: 0.5;"),
        (70, "opacity: 0; transform: scale(1.5);"),
        (100, "opacity: 0; transform: scale(1.5);"),
    ]
    rings = "".join(
        '<circle class="rip" r="40" style="animation-delay:%.2fs;"/>' % (-i * dur / 3.0)
        for i in range(3)
    )
    style = "\n".join([
        ".wash { opacity: 0; fill: #5a5a63; animation: wash %ss ease-in-out infinite; }" % dur,
        ".rip { opacity: 0; fill: none; stroke: #8b8b95; stroke-width: 2; "
        "transform: scale(0.05); animation: rip %ss ease-out infinite; }" % dur,
        keyframes("wash", wash),
        keyframes("rip", ring),
        reduced([".wash { animation: none; opacity: 0.28; }",
                 ".rip { animation: none; opacity: 0.35; transform: scale(1); }"]),
    ])
    defs = clip_def(card_h)
    body = ('%s'
            '<rect class="wash" width="%d" height="%d" rx="7"/>'
            '<g transform="translate(%.0f %.0f)">%s</g>'
            % (card_image(b64, card_h), CARD_W, card_h, ecx, ecy, rings))
    return ("Surface-1 schemeTwistResolved — desaturation ripple",
            "Animated mock: a Scheme Twist card dims under a slow grey desaturation wash while faint "
            "ash-grey rings ripple outward from the centre — darker and subtler than a Strike. Loops.",
            defs, style, body)


# ---------------------------------------------------------------------------
# healResolved — soft green restorative shimmer rising off the card
# ---------------------------------------------------------------------------
def build_heal(b64, card_h):
    dur = 3.4
    glow = [
        (0, "opacity: 0.14;"),
        (50, "opacity: 0.40;"),
        (100, "opacity: 0.14;"),
    ]
    mote = [
        (0, "opacity: 0; transform: translateY(0) scale(0.5);"),
        (14, "opacity: 0.9;"),
        (82, "opacity: 0.5;"),
        (100, "opacity: 0; transform: translateY(var(--rise)) scale(1.05);"),
    ]
    rnd = seeded(909, 48)
    motes = []
    for i in range(12):
        mx = 20 + rnd[i * 3] * (CARD_W - 40)
        rise = -(card_h * 0.6 + rnd[i * 3 + 1] * card_h * 0.32)
        delay = -(rnd[i * 3 + 2] * dur)
        radius = 2.4 + (i % 3) * 0.9
        motes.append(
            '<g transform="translate(%.0f %d)">'
            '<circle class="mote" r="%.1f" style="--rise:%.0fpx; animation-delay:%.2fs;"/></g>'
            % (mx, card_h - 6, radius, rise, delay))
    style = "\n".join([
        ".hglow { opacity: 0.14; fill: url(#hg); animation: hglow %ss ease-in-out infinite; }" % dur,
        ".mote { opacity: 0; fill: #8effb0; transform: translateY(0) scale(0.5); "
        "animation: mote %ss ease-out infinite; }" % dur,
        keyframes("hglow", glow),
        keyframes("mote", mote),
        reduced([".hglow { animation: none; opacity: 0.3; }",
                 ".mote { animation: none; opacity: 0; }"]),
    ])
    defs = (clip_def(card_h) +
            '<radialGradient id="hg" cx="50%" cy="78%" r="70%">'
            '<stop offset="0%" stop-color="#57f08a" stop-opacity="0.9"/>'
            '<stop offset="100%" stop-color="#57f08a" stop-opacity="0"/></radialGradient>')
    body = ('%s'
            '<rect class="hglow" width="%d" height="%d" rx="7"/>%s'
            % (card_image(b64, card_h), CARD_W, card_h, "".join(motes)))
    return ("Surface-1 healResolved — restorative green shimmer",
            "Animated mock: a Wound card glows with a soft green restorative light while green motes "
            "rise and fade upward off the card — a gentle heal shimmer. Loops.",
            defs, style, body)


BUILDERS = [
    ("surface1-mastermind-strike",     "strike",      build_strike),
    ("surface1-fight-resolved",        "fight",       build_fight),
    ("surface1-ambush-resolved",       "ambush",      build_ambush),
    ("surface1-scheme-twist-resolved", "schemetwist", build_schemetwist),
    ("surface1-heal-resolved",         "heal",        build_heal),
]

if __name__ == "__main__":
    for slug, card_key, builder in BUILDERS:
        b64, _, card_h = load_card(card_key)
        title, aria, defs, style, body = builder(b64, card_h)
        size = assemble(slug, title, aria, defs, style, body, card_h)
        print("%-34s %6d bytes  (card %dx%d)" % (slug + ".svg", size, CARD_W, card_h))
