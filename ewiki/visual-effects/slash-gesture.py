"""
Generate the animated-SVG mocks for the SHIPPED slash gesture (Visual Effects
Framework wiki page, #slash-to-fight):

- slash-to-fight.svg — a finger (or mouse) sweeps across the City row; the
  white-and-lavender blade trail follows it; each villain the stroke FULLY
  crosses splits along the stroke's angle, in crossing order (WP-756 /
  D-24585). A villain the stroke never crosses is left untouched.
- long-press-slash.svg — the phone case: the City row scrolls sideways, so the
  finger first HOLDS still (a ring fills over the 350 ms arm), the row arms
  (the inset lavender glow + a buzz), and only then does the drag slash
  (WP-761 / D-24592).

Same card-less-art, vector-only, CSS-only approach as villain-slash.py, so both
animate on the JS-free ewiki via <img>. Both loop, and honour
@media (prefers-reduced-motion: reduce) by holding one static frame.

Colours are the shipped ones: the villain ink from villainSlashVfxManifest.ts
(VILLAIN_SLASH_VFX.colors) and the streak / blade-trail core #ffffff and glow
#d6c2ff (the blade trail imports the same streak colours). The halves are cut
with the same through-the-centre half-plane split as villainSlashGeometry.ts,
at the stroke angle (the WP-756 angle hint).

These are SHIPPED effects; the mocks illustrate the live behaviour (which
slices the real card art). Timings are stretched so the motion reads at a
glance — the live arm is 350 ms and the live trail fades within 170 ms.

Output: slash-to-fight.svg, long-press-slash.svg
"""

import math

FONT = ("font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif; "
        "font-weight: 900; font-style: italic; letter-spacing: 1px;")

CARD_W, CARD_H = 96, 134                  # the CardTile 5:7 ratio, row-sized

VILLAIN = "#7b1fa2"
VILLAIN_DEEP = "#4a0d67"
VILLAIN_BRIGHT = "#b44fd6"
STREAK_CORE = "#ffffff"
STREAK_GLOW = "#d6c2ff"


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def split_card(width, height, angle_deg):
    """villainSlashGeometry.splitCardAlongCut: the card cut through its centre."""
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


def card_art(accent):
    """A stylised villain card (the live beat slices the REAL card art)."""
    w, h = CARD_W, CARD_H
    return (
        f'<rect x="0" y="0" width="{w}" height="{h}" rx="7" fill="url(#cardbg)"/>'
        f'<rect x="3" y="3" width="{w - 6}" height="{h - 6}" rx="5" fill="none" stroke="{accent}" stroke-width="2"/>'
        f'<circle cx="{w / 2}" cy="50" r="18" fill="#1a0726"/>'
        f'<path d="M {w / 2 - 18} 47 q 18 -28 36 0 l 0 8 q -18 -7 -36 0 z" fill="{VILLAIN}"/>'
        f'<path d="M {w / 2 - 34} 122 q 34 -64 68 0 z" fill="#1a0726"/>'
        f'<circle cx="{w / 2 - 6}" cy="52" r="2.5" fill="{accent}"/>'
        f'<circle cx="{w / 2 + 6}" cy="52" r="2.5" fill="{accent}"/>'
        f'<rect x="8" y="{h - 24}" width="{w - 16}" height="14" rx="3" fill="#12051b" opacity="0.85"/>'
        f'<rect x="14" y="{h - 19}" width="{w - 30}" height="4" rx="2" fill="{accent}"/>'
    )


def shared_defs(halves):
    def points(polygon):
        return " ".join("%.1f,%.1f" % point for point in polygon)

    return (
        f'<radialGradient id="bg" cx="50%" cy="44%" r="82%">'
        f'<stop offset="0%" stop-color="#150d1a"/><stop offset="100%" stop-color="#08060b"/></radialGradient>'
        f'<linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="#3a1450"/><stop offset="100%" stop-color="#1a0726"/></linearGradient>'
        f'<linearGradient id="blade" x1="0" y1="0" x2="1" y2="0">'
        f'<stop offset="0%" stop-color="{STREAK_GLOW}" stop-opacity="0"/>'
        f'<stop offset="25%" stop-color="{STREAK_GLOW}"/><stop offset="50%" stop-color="{STREAK_CORE}"/>'
        f'<stop offset="75%" stop-color="{STREAK_GLOW}"/>'
        f'<stop offset="100%" stop-color="{STREAK_GLOW}" stop-opacity="0"/></linearGradient>'
        f'<clipPath id="cuta"><polygon points="{points(halves[0])}"/></clipPath>'
        f'<clipPath id="cutb"><polygon points="{points(halves[1])}"/></clipPath>'
        f'<filter id="glow" x="-30%" y="-300%" width="160%" height="700%">'
        f'<feGaussianBlur stdDeviation="3"/></filter>'
        f'<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">'
        f'<feGaussianBlur stdDeviation="4"/></filter>'
    )


class Scene:
    """Collects CSS rules, keyframes and SVG body parts for one mock."""

    def __init__(self, duration):
        self.duration = duration
        self.rules = ["text { %s }" % FONT]
        self.frames = []
        self.reduced = []
        self.body = []

    def animate(self, cls, stops, easing="linear", extra=""):
        self.rules.append(".%s { opacity: 0; %sanimation: %s %ss %s infinite; }"
                          % (cls, extra, cls, self.duration, easing))
        self.frames.append(keyframes(cls, stops))

    def css(self):
        reduced = "@media (prefers-reduced-motion: reduce) {\n%s\n}" % "\n".join(self.reduced)
        return "\n".join(self.rules + self.frames + [reduced])


def add_sliced_card(scene, key, origin, cut_pct, angle, halves, normal, accent, fade_in=4.0):
    """A card that sits whole, then splits along `angle` at `cut_pct` and flies apart."""
    ox, oy = origin
    base = "translate(%.1fpx,%.1fpx)" % (ox, oy)
    normal_x, normal_y = normal

    scene.animate(key + "w", [(0, "opacity: 0;"), (fade_in, "opacity: 1;"), (cut_pct, "opacity: 1;"),
                              (cut_pct + 0.01, "opacity: 0;"), (100, "opacity: 0;")])

    def half_stops(side):
        stops = [(0, "opacity: 1; transform: %s translate(0px,0px) rotate(0deg);" % base),
                 (cut_pct, "opacity: 1; transform: %s translate(0px,0px) rotate(0deg);" % base)]
        flight = min(26.0, 99.0 - cut_pct)
        for step in range(1, 11):
            progress = step / 10
            separation = 38 * (1 - (1 - progress) ** 2)
            offset_x = side * (separation * normal_x + 22 * progress)
            offset_y = side * separation * normal_y - 170 * progress + 440 * progress * progress
            opacity = 1 if progress <= 0.6 else 1 - (progress - 0.6) / 0.4
            stops.append((cut_pct + flight * progress,
                          "opacity: %.2f; transform: %s translate(%.1fpx,%.1fpx) rotate(%.1fdeg);"
                          % (opacity, base, offset_x, offset_y, side * 38 * progress)))
        stops.append((100, "opacity: 0; transform: %s;" % base))
        return stops

    scene.animate(key + "a", half_stops(-1))
    scene.animate(key + "b", half_stops(1))

    cx, cy = ox + CARD_W / 2, oy + CARD_H / 2
    streak_length = math.hypot(CARD_W, CARD_H) * 1.3
    scene.animate(key + "s", [
        (0, "opacity: 0; transform: translate(%.1fpx,%.1fpx) rotate(%.1fdeg) scaleX(0.1);" % (cx, cy, angle)),
        (cut_pct - 2, "opacity: 0; transform: translate(%.1fpx,%.1fpx) rotate(%.1fdeg) scaleX(0.1);" % (cx, cy, angle)),
        (cut_pct, "opacity: 1; transform: translate(%.1fpx,%.1fpx) rotate(%.1fdeg) scaleX(1);" % (cx, cy, angle)),
        (cut_pct + 6, "opacity: 0; transform: translate(%.1fpx,%.1fpx) rotate(%.1fdeg) scaleX(1.06);" % (cx, cy, angle)),
        (100, "opacity: 0;"),
    ], easing="ease-out")

    art = card_art(accent)
    scene.body.append(
        f'<g class="{key}w" transform="translate({ox} {oy})">{art}</g>'
        f'<g class="{key}a"><g clip-path="url(#cuta)">{art}</g></g>'
        f'<g class="{key}b"><g clip-path="url(#cutb)">{art}</g></g>'
        f'<g class="{key}s"><rect x="{-streak_length / 2:.1f}" y="-4" width="{streak_length:.1f}" height="8" '
        f'rx="4" fill="{STREAK_GLOW}" filter="url(#glow)"/><rect x="{-streak_length / 2:.1f}" y="-2.5" '
        f'width="{streak_length:.1f}" height="5" rx="2.5" fill="url(#blade)"/></g>'
    )
    # Reduced motion: the split card, halves nudged apart along the cut normal.
    scene.reduced.append("  .%sw, .%ss { animation: none; opacity: 0; }" % (key, key))
    scene.reduced.append("  .%sa { animation: none; opacity: 1; transform: %s translate(%.1fpx,%.1fpx); }"
                         % (key, base, -8 * normal_x, -8 * normal_y))
    scene.reduced.append("  .%sb { animation: none; opacity: 1; transform: %s translate(%.1fpx,%.1fpx); }"
                         % (key, base, 8 * normal_x, 8 * normal_y))


def add_blade_trail(scene, start, end, move_from, move_to, fade_to):
    """The blade trail: a glowing ribbon whose head rides the pointer, fading at release."""
    (x0, y0), (x1, y1) = start, end
    length = math.hypot(x1 - x0, y1 - y0)
    path = "M %.1f %.1f L %.1f %.1f" % (x0, y0, x1, y1)

    def dash_stops(tail):
        # why: a dash of `tail` px whose leading edge sits on the pointer — the
        # dash covers [head - tail, head] when dashoffset = tail - head.
        return [
            (0, "stroke-dashoffset: %.1f; opacity: 0;" % tail),
            (move_from, "stroke-dashoffset: %.1f; opacity: 1;" % tail),
            (move_to, "stroke-dashoffset: %.1f; opacity: 1;" % (tail - length)),
            (fade_to, "stroke-dashoffset: %.1f; opacity: 0;" % (tail - length)),
            (100, "stroke-dashoffset: %.1f; opacity: 0;" % tail),
        ]

    scene.animate("trailglow", dash_stops(110))
    scene.animate("trailcore", dash_stops(110))
    scene.animate("trailhead", dash_stops(34))
    scene.body.append(
        f'<path class="trailglow" d="{path}" stroke="{STREAK_GLOW}" stroke-width="16" stroke-linecap="round" '
        f'fill="none" stroke-dasharray="110 2000" filter="url(#soft)"/>'
        f'<path class="trailcore" d="{path}" stroke="{STREAK_GLOW}" stroke-width="6" stroke-linecap="round" '
        f'fill="none" stroke-dasharray="110 2000"/>'
        f'<path class="trailhead" d="{path}" stroke="{STREAK_CORE}" stroke-width="9" stroke-linecap="round" '
        f'fill="none" stroke-dasharray="34 2000"/>'
    )
    # Reduced motion: the whole stroke, faint, as a static trace.
    scene.reduced.append("  .trailglow, .trailcore { animation: none; opacity: 0.5; stroke-dasharray: none; }")
    scene.reduced.append("  .trailhead { animation: none; opacity: 0; }")


def add_finger(scene, start, end, appear, move_from, move_to, leave, hold_ring=None):
    """The touch point: appears, (optionally holds while a ring fills), drags, lifts."""
    (x0, y0), (x1, y1) = start, end
    at_start = "transform: translate(%.1fpx,%.1fpx);" % (x0, y0)
    at_end = "transform: translate(%.1fpx,%.1fpx);" % (x1, y1)
    scene.animate("finger", [
        (0, "opacity: 0; " + at_start),
        (appear, "opacity: 0.95; " + at_start),
        (move_from, "opacity: 0.95; " + at_start),
        (move_to, "opacity: 0.95; " + at_end),
        (leave, "opacity: 0; " + at_end),
        (100, "opacity: 0; " + at_end),
    ])
    scene.body.append(
        '<g class="finger"><circle r="17" fill="#ffffff" opacity="0.18"/>'
        '<circle r="10" fill="#ffffff" opacity="0.55"/><circle r="4" fill="#ffffff"/></g>'
    )
    scene.reduced.append("  .finger { animation: none; opacity: 0.9; transform: translate(%.1fpx,%.1fpx); }"
                         % (x1, y1))
    if hold_ring is not None:
        ring_from, ring_to = hold_ring
        circumference = 2 * math.pi * 24
        scene.animate("ring", [
            (0, "opacity: 0; stroke-dashoffset: %.1f;" % circumference),
            (ring_from, "opacity: 1; stroke-dashoffset: %.1f;" % circumference),
            (ring_to, "opacity: 1; stroke-dashoffset: 0;"),
            (ring_to + 3, "opacity: 0; stroke-dashoffset: 0;"),
            (100, "opacity: 0; stroke-dashoffset: 0;"),
        ])
        scene.body.append(
            f'<g transform="translate({x0} {y0})"><circle class="ring" r="24" fill="none" '
            f'stroke="{STREAK_GLOW}" stroke-width="4" stroke-linecap="round" '
            f'stroke-dasharray="{circumference:.1f}" transform="rotate(-90)"/></g>'
        )
        scene.reduced.append("  .ring { animation: none; opacity: 0; }")


def wrap(width, height, scene, defs, aria, title, backdrop=""):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
        '  %s%s\n'
        '</svg>\n'
    ) % (width, height, width, height, aria, title, scene.css(), defs, width, height,
         backdrop, "".join(scene.body))


def slash_to_fight():
    width, height = 520, 300
    duration = 3.6
    row_y = 70
    card_xs = [62, 202, 362]                        # the third villain is never crossed
    start, end = (22.0, 118.0), (330.0, 150.0)     # ends in the gap before card 3
    angle = math.degrees(math.atan2(end[1] - start[1], end[0] - start[0]))
    halves, normal = split_card(CARD_W, CARD_H, angle)
    move_from, move_to = 12.0, 42.0

    def exit_pct(card_x):
        # why: a villain completes its crossing when the stroke LEAVES it — the
        # full-crossing rule — so each slice lands at its right-edge exit.
        fraction = (card_x + CARD_W - start[0]) / (end[0] - start[0])
        return move_from + (move_to - move_from) * fraction

    scene = Scene(duration)
    backdrop = (
        f'<rect x="40" y="{row_y - 14}" width="{width - 80}" height="{CARD_H + 28}" rx="10" '
        f'fill="#120a18" stroke="#2c1d38" stroke-width="1"/>'
    )
    add_sliced_card(scene, "c1", (card_xs[0], row_y), exit_pct(card_xs[0]), angle, halves, normal, VILLAIN_BRIGHT)
    add_sliced_card(scene, "c2", (card_xs[1], row_y), exit_pct(card_xs[1]), angle, halves, normal, VILLAIN_BRIGHT)
    # The third villain: the stroke stops short of it, so it is never fought.
    scene.body.append(f'<g transform="translate({card_xs[2]} {row_y})">{card_art(VILLAIN_BRIGHT)}</g>')
    add_blade_trail(scene, start, end, move_from, move_to, move_to + 6)
    add_finger(scene, start, end, 6.0, move_from, move_to, move_to + 5)

    for index, (card_x, label) in enumerate(((card_xs[0], "1"), (card_xs[1], "2"))):
        cut = exit_pct(card_x)
        cls = "n%d" % (index + 1)
        scene.animate(cls, [(0, "opacity: 0;"), (cut, "opacity: 0;"), (cut + 3, "opacity: 1;"),
                            (86, "opacity: 1;"), (94, "opacity: 0;"), (100, "opacity: 0;")])
        scene.body.append(
            f'<g class="{cls}" transform="translate({card_x + CARD_W / 2} {row_y + CARD_H + 38})">'
            f'<circle r="13" fill="{VILLAIN}" stroke="{STREAK_GLOW}" stroke-width="2"/>'
            f'<text x="0" y="1" text-anchor="middle" dominant-baseline="central" font-size="15" '
            f'fill="#ffffff">{label}</text></g>'
        )
        scene.reduced.append("  .%s { animation: none; opacity: 1; }" % cls)

    aria = ("Animated mock of slash to fight: a finger sweeps across the City row and a glowing "
            "white-and-lavender blade trail follows it; the first villain it fully crosses splits "
            "along the stroke's angle, then the second, marked 1 and 2 in crossing order; the third "
            "villain, which the stroke never crosses, is untouched. Loops.")
    title = "Shipped slash to fight — every villain the stroke fully crosses is fought, in order"
    return wrap(width, height, scene, shared_defs(halves), aria, title, backdrop)


def long_press_slash():
    width, height = 360, 330
    duration = 4.8
    row_y = 96
    card_xs = [70, 196, 322]                        # the third card runs off the phone edge
    press = (40.0, 150.0)                           # a gap / slot label left of card 1
    end = (304.0, 170.0)
    angle = math.degrees(math.atan2(end[1] - press[1], end[0] - press[0]))
    halves, normal = split_card(CARD_W, CARD_H, angle)
    hold_from, armed_at = 8.0, 34.0
    move_from, move_to = 40.0, 62.0

    def exit_pct(card_x):
        fraction = (card_x + CARD_W - press[0]) / (end[0] - press[0])
        return move_from + (move_to - move_from) * fraction

    scene = Scene(duration)
    frame_x, frame_w = 18, width - 36
    backdrop = (
        # the phone-width City row; the right edge fades out to show it scrolls sideways
        f'<linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">'
        f'<stop offset="0" stop-color="#08060b" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="#08060b" stop-opacity="0.95"/></linearGradient>'
        f'<rect x="{frame_x}" y="{row_y - 16}" width="{frame_w}" height="{CARD_H + 32}" rx="10" '
        f'fill="#120a18" stroke="#2c1d38" stroke-width="1"/>'
    )
    # The armed glow: an INSET lavender ring on the row (the shipped
    # city-spaces--gesture-armed), on from the arm until the finger lifts.
    scene.animate("armed", [(0, "opacity: 0;"), (armed_at, "opacity: 0;"), (armed_at + 2, "opacity: 1;"),
                            (move_to + 2, "opacity: 1;"), (move_to + 6, "opacity: 0;"), (100, "opacity: 0;")])
    scene.body.append(
        f'<rect class="armed" x="{frame_x + 3}" y="{row_y - 13}" width="{frame_w - 6}" height="{CARD_H + 26}" '
        f'rx="8" fill="none" stroke="{STREAK_GLOW}" stroke-width="3"/>'
        f'<rect class="armed" x="{frame_x + 6}" y="{row_y - 10}" width="{frame_w - 12}" height="{CARD_H + 20}" '
        f'rx="7" fill="none" stroke="{STREAK_GLOW}" stroke-width="8" opacity="0.35" filter="url(#soft)"/>'
    )
    scene.reduced.append("  .armed { animation: none; opacity: 1; }")

    add_sliced_card(scene, "c1", (card_xs[0], row_y), exit_pct(card_xs[0]), angle, halves, normal, VILLAIN_BRIGHT)
    add_sliced_card(scene, "c2", (card_xs[1], row_y), exit_pct(card_xs[1]), angle, halves, normal, VILLAIN_BRIGHT)
    scene.body.append(f'<g transform="translate({card_xs[2]} {row_y})">{card_art(VILLAIN_BRIGHT)}</g>')
    scene.body.append(f'<rect x="{width - 70}" y="{row_y - 16}" width="52" height="{CARD_H + 32}" fill="url(#edge)"/>')

    add_blade_trail(scene, press, end, move_from, move_to, move_to + 6)
    add_finger(scene, press, end, 4.0, move_from, move_to, move_to + 5, hold_ring=(hold_from, armed_at))

    # Captions: "hold…" while the ring fills, then "ARMED" with a buzz.
    scene.animate("hold", [(0, "opacity: 0;"), (hold_from, "opacity: 1;"), (armed_at, "opacity: 1;"),
                           (armed_at + 2, "opacity: 0;"), (100, "opacity: 0;")])
    scene.animate("arm", [
        (0, "opacity: 0; transform: translate(%.1fpx,%dpx) scale(0.6);" % (width / 2, 44)),
        (armed_at, "opacity: 0; transform: translate(%.1fpx,%dpx) scale(0.6);" % (width / 2, 44)),
        (armed_at + 2, "opacity: 1; transform: translate(%.1fpx,%dpx) scale(1.15);" % (width / 2, 44)),
        (armed_at + 3, "transform: translate(%.1fpx,%dpx) scale(1.15) rotate(-3deg);" % (width / 2 + 2, 44)),
        (armed_at + 4, "transform: translate(%.1fpx,%dpx) scale(1.15) rotate(3deg);" % (width / 2 - 2, 44)),
        (armed_at + 6, "opacity: 1; transform: translate(%.1fpx,%dpx) scale(1);" % (width / 2, 44)),
        (move_to + 4, "opacity: 1; transform: translate(%.1fpx,%dpx) scale(1);" % (width / 2, 44)),
        (move_to + 8, "opacity: 0; transform: translate(%.1fpx,%dpx) scale(1);" % (width / 2, 44)),
        (100, "opacity: 0;"),
    ], easing="ease-out")
    scene.body.append(
        f'<text class="hold" x="{width / 2}" y="44" text-anchor="middle" dominant-baseline="central" '
        f'font-size="20" fill="{STREAK_GLOW}">hold…</text>'
        f'<text class="arm" x="0" y="0" text-anchor="middle" dominant-baseline="central" '
        f'font-size="26" fill="#ffffff">ARMED</text>'
        f'<text x="{width / 2}" y="{height - 22}" text-anchor="middle" font-size="12" fill="#8d7d99" '
        f'style="font-style: normal; font-weight: 700; letter-spacing: 0.5px;">phone: the row scrolls → hold, then slash</text>'
    )
    scene.reduced.append("  .hold { animation: none; opacity: 0; }")
    scene.reduced.append("  .arm { animation: none; opacity: 1; transform: translate(%.1fpx,44px) scale(1); }"
                         % (width / 2))

    aria = ("Animated mock of the long-press slash on a phone: the City row scrolls sideways, so a "
            "finger first holds still on a gap while a lavender ring fills; the row arms with an "
            "inset lavender glow and the word ARMED gives a small buzz; then the finger drags right, "
            "a blade trail follows, and the two villains it fully crosses split along the stroke in "
            "order while the row stays put. Loops.")
    title = "Shipped long-press slash — hold 350 ms to arm, then slash, on a City row that scrolls"
    return wrap(width, height, scene, shared_defs(halves), aria, title, backdrop)


if __name__ == "__main__":
    for name, builder in (("slash-to-fight.svg", slash_to_fight), ("long-press-slash.svg", long_press_slash)):
        svg = builder()
        with open(name, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(svg)
        print("%-32s %6d bytes" % (name, len(svg)))
