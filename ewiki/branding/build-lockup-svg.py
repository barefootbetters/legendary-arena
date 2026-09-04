"""
Extract the Legendary Arena horizontal lockup and wordmark as vector SVGs.

Unlike the emblem (which is autotraced from a raster), the lockup master is a
*true vector extraction*: `Legendary Arena-400x200.ai` is PDF-compatible, so
Inkscape imports its real paths and gradients directly — the letterforms are
already outlined, and only small soft-glow effects remain as embedded rasters.
This is strictly higher fidelity than an autotrace.

The .ai is the editable master and, per the brand-folder rules, stays in
pCloud (it is NOT copied into this repo). This generator reads it from there,
so regenerating requires the .ai present at AI_SOURCE.

Pipeline:
  1. Inkscape imports the .ai and exports plain SVG (real paths + gradients).
  2. Inkscape --query-all reports every element's bounding box.
  3. The full-doc black background is dropped (transparent master), and the
     emblem (every element whose bbox sits left of SPLIT_X, i.e. left of the
     "L") is removed to isolate the wordmark.
  4. Each master is written transparent, plus an on-dark-plate display variant
     (the lockup is designed for dark surfaces; on a light page the white
     "ARENA" and the villain half would disappear).

Outputs (beside this script):
  logo-la-lockup.svg / logo-la-lockup-on-dark.svg
  logo-la-wordmark.svg / logo-la-wordmark-on-dark.svg

Dependencies: Inkscape 1.x on PATH (the `inkscape` command).
Regenerate:   python build-lockup-svg.py
"""
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
AI_SOURCE = Path(r'C:\pcloud\LA\brand\Legendary Arena-400x200.ai')
# Gap (in the .ai's 533-wide user space) between the emblem's right edge and
# the "L" of LEGENDARY. Elements whose whole bbox is left of this are emblem.
SPLIT_X = 170.0

SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
# Structural elements never removed: the root, Inkscape layers, full-doc bg.
STRUCTURAL = {'svg1', 'layer-MC0', 'layer-MC1', 'path1'}


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def extract_plain_svg(intermediate):
    run(['inkscape', str(AI_SOURCE), '--export-type=svg', '--export-plain-svg',
         f'--export-filename={intermediate}'])


def query_bboxes(intermediate):
    out = subprocess.run(['inkscape', str(intermediate), '--query-all'],
                         check=True, capture_output=True, text=True).stdout
    boxes = {}
    for line in out.splitlines():
        parts = line.strip().split(',')
        if len(parts) == 5:
            try:
                boxes[parts[0]] = tuple(float(v) for v in parts[1:])
            except ValueError:
                pass
    return boxes


def parent_map(tree):
    return {child: parent for parent in tree.iter() for child in parent}


def local(tag):
    return tag.split('}')[-1]


def remove_where(tree, boxes, predicate):
    pm = parent_map(tree)
    for el in list(tree.iter()):
        eid = el.get('id')
        if eid in STRUCTURAL or eid not in boxes or el not in pm:
            continue
        if predicate(*boxes[eid]):
            pm[el].remove(el)


def drop_background(tree):
    pm = parent_map(tree)
    for el in list(tree.iter()):
        if el.get('id') == 'path1' and el in pm:
            pm[el].remove(el)


def content_bbox(tree, boxes):
    x0 = y0 = 1e9
    x1 = y1 = -1e9
    for el in tree.iter():
        eid = el.get('id')
        if eid in boxes and eid not in STRUCTURAL and local(el.tag) in ('path', 'image'):
            x, y, w, h = boxes[eid]
            x0, y0 = min(x0, x), min(y0, y)
            x1, y1 = max(x1, x + w), max(y1, y + h)
    return x0, y0, x1, y1


def write_svg(tree, name, bbox, pad=8, plate=False):
    x0, y0, x1, y1 = bbox
    vx, vy, vw, vh = x0 - pad, y0 - pad, (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad
    root = tree.getroot()
    root.set('viewBox', f'{vx:.3f} {vy:.3f} {vw:.3f} {vh:.3f}')
    for attr in ('width', 'height'):
        root.attrib.pop(attr, None)
    if plate:
        root.insert(0, ET.Element(f'{{{SVG_NS}}}rect', {
            'x': f'{vx:.3f}', 'y': f'{vy:.3f}', 'width': f'{vw:.3f}',
            'height': f'{vh:.3f}', 'rx': '10', 'fill': '#0b0f19'}))
    (HERE / name).write_text(
        ET.tostring(root, encoding='unicode'), encoding='utf-8')
    print('wrote', name)


def main():
    intermediate = HERE / '.lockup-plain.svg'
    extract_plain_svg(intermediate)
    boxes = query_bboxes(intermediate)
    ET.register_namespace('', SVG_NS)

    def load():
        return ET.parse(intermediate)

    # Lockup: transparent master + on-dark display variant.
    tree = load(); drop_background(tree)
    lockup_box = content_bbox(tree, boxes)
    write_svg(tree, 'logo-la-lockup.svg', lockup_box)
    tree = load(); drop_background(tree)
    write_svg(tree, 'logo-la-lockup-on-dark.svg', lockup_box, plate=True)

    # Wordmark: drop emblem (bbox fully left of the "L").
    tree = load(); drop_background(tree)
    remove_where(tree, boxes, lambda x, y, w, h: x + w <= SPLIT_X)
    word_box = content_bbox(tree, boxes)
    write_svg(tree, 'logo-la-wordmark.svg', word_box)
    tree = load(); drop_background(tree)
    remove_where(tree, boxes, lambda x, y, w, h: x + w <= SPLIT_X)
    write_svg(tree, 'logo-la-wordmark-on-dark.svg', word_box, plate=True)

    intermediate.unlink()


if __name__ == '__main__':
    main()
