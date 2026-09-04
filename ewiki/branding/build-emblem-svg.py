"""
Trace the Legendary Arena emblem into a layered, recolorable SVG master.

The emblem is a single mark split down the centre — a gold winged sword (the
hero) mirrored against a white bone-and-horn mark (the villain). This script
separates the flattened raster `emblem-trace-source.png` into three tone masks
(gold / white / black stroke-work), vector-traces each with vtracer, and
reassembles them as three stacked <g fill> layers so every tone is a flat,
recolorable fill. The hero half gets one continuous brand-gold gradient
(#f0c94a -> #d4af37 -> #b8901f, the brand-tokens.css golds).

Input  : emblem-trace-source.png  — the matted emblem raster, a flattened
         export from LA\\brand\\segments.zip (the layered/editable sources stay
         in pCloud per the brand-folder rules; this flattened raster is the
         reproducible trace input).
Outputs: logo-la-emblem.svg          — transparent vector master.
         logo-la-emblem-on-dark.svg  — the same mark on a dark rounded plate,
         for light-background display (on a light page the white villain half
         would otherwise disappear; the emblem is designed for dark surfaces).

Dependencies: pip install vtracer pillow numpy
Regenerate:   python build-emblem-svg.py   (run from this directory)
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image
import vtracer

HERE = Path(__file__).resolve().parent
SRC = HERE / 'emblem-trace-source.png'
OUT = HERE / 'logo-la-emblem.svg'
OUT_DARK = HERE / 'logo-la-emblem-on-dark.svg'

# Tone-mask thresholds over opaque pixels. The source is near-binary in alpha
# (a pixel is either the mark or fully transparent) and cleanly tri-tone.
image = Image.open(SRC).convert('RGBA')
pixels = np.asarray(image).astype(np.int16)
red, green, blue, alpha = (pixels[..., i] for i in range(4))
opaque = alpha > 128
brightest = np.maximum(np.maximum(red, green), blue)
darkest = np.minimum(np.minimum(red, green), blue)

black_mask = opaque & (brightest < 70)
white_mask = opaque & (darkest > 150)
gold_mask = opaque & ~black_mask & ~white_mask

# vtracer settings. The black stroke layer carries the matting noise, so it is
# speckle-filtered harder than the gold/white shapes, whose fine tips (sword
# point, horn segments) must survive.
TRACE_OPTIONS = dict(
    colormode='binary', mode='spline',
    corner_threshold=60, length_threshold=4.0, splice_threshold=45,
    path_precision=6,
)
SPECKLE = {'gold': 8, 'white': 8, 'black': 20}


def trace_mask(mask, name):
    """Render a boolean mask as black-on-white, vector-trace it, and return the
    full <path> elements. Each vtracer path carries its own translate transform,
    so the whole element is kept; only its fill is stripped so a wrapping
    <g fill> recolors it."""
    shape = np.where(mask[..., None], 0, 255).astype(np.uint8)
    rgb = np.repeat(shape, 3, axis=2)
    mask_png = HERE / f'.mask-{name}.png'
    mask_svg = HERE / f'.mask-{name}.svg'
    Image.fromarray(rgb, 'RGB').save(mask_png)
    vtracer.convert_image_to_svg_py(str(mask_png), str(mask_svg),
                                    filter_speckle=SPECKLE[name], **TRACE_OPTIONS)
    traced = mask_svg.read_text(encoding='utf-8')
    elements = re.findall(r'<path\b[^>]*/>', traced)
    mask_png.unlink()
    mask_svg.unlink()
    return [re.sub(r'\s*fill="[^"]*"', '', element) for element in elements]


def layer(elements, fill):
    body = '\n'.join('    ' + element for element in elements)
    return f'  <g fill="{fill}">\n{body}\n  </g>'


gold_paths = trace_mask(gold_mask, 'gold')
white_paths = trace_mask(white_mask, 'white')
black_paths = trace_mask(black_mask, 'black')

# Tight crop: viewBox to the opaque bounding box plus uniform padding. Path
# coordinates are absolute, so shifting the viewBox crops without moving geometry.
opaque_rows, opaque_cols = np.where(opaque)
PAD = 24
view_x = int(opaque_cols.min()) - PAD
view_y = int(opaque_rows.min()) - PAD
view_w = int(opaque_cols.max()) - view_x + PAD
view_h = int(opaque_rows.max()) - view_y + PAD

# One continuous gold gradient across the hero half's vertical extent
# (userSpaceOnUse — objectBoundingBox would restart the gradient per subpath).
gold_rows = np.where(gold_mask)[0]
gradient = (
    '<linearGradient id="la-gold" gradientUnits="userSpaceOnUse" '
    f'x1="0" y1="{int(gold_rows.min())}" x2="0" y2="{int(gold_rows.max())}">'
    '<stop offset="0" stop-color="#f0c94a"/>'
    '<stop offset="0.5" stop-color="#d4af37"/>'
    '<stop offset="1" stop-color="#b8901f"/></linearGradient>'
)

layers = (layer(gold_paths, 'url(#la-gold)') + '\n'
          + layer(white_paths, '#ffffff') + '\n'
          + layer(black_paths, '#0b0f19'))
header = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_x} {view_y} {view_w} {view_h}" '
          'role="img" aria-label="Legendary Arena emblem">\n'
          '  <title>Legendary Arena emblem</title>\n'
          f'  <defs>{gradient}</defs>\n')

OUT.write_text(header + layers + '\n</svg>\n', encoding='utf-8')

plate = (f'  <rect x="{view_x}" y="{view_y}" width="{view_w}" height="{view_h}" '
         'rx="64" fill="#0b0f19"/>\n')
OUT_DARK.write_text(header + plate + layers + '\n</svg>\n', encoding='utf-8')

print(f'paths gold/white/black: {len(gold_paths)}/{len(white_paths)}/{len(black_paths)}')
for path in (OUT, OUT_DARK):
    print('wrote', path.name, path.stat().st_size, 'bytes')
