"""Generate a dot-matrix map of the Middle East and Africa as an SVG.

Source: Natural Earth 1:110m admin-0 countries (public domain), saved to a
temp file before running:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Run from the project root:  python scripts/make-region-map.py
Output: assets/graphics/middle-east-africa-dot-map-focus-markets.svg
"""

import json
import os
from pathlib import Path

SOURCE = Path(os.environ.get("TEMP", "/tmp")) / "ne_110m_countries.geojson"
OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "graphics" / "regions-map.svg"

# Map window in degrees (lon, lat)
LON_MIN, LON_MAX = -20.0, 62.0
LAT_MIN, LAT_MAX = -36.0, 42.0
STEP = 1.4  # spacing between dot centres, in degrees

SCALE = 10  # SVG units per degree
DOT_R = 3.6

MIDDLE_EAST = {"ARE", "SAU", "QAT", "KWT", "OMN", "IRQ"}
AFRICA = {"AGO", "NGA", "MOZ", "NAM"}

GOLD = "#c9a05a"
NAVY = "#14213d"
GREY = "#c8d0d8"


def ring_contains(ring, x, y):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    if geometry["type"] == "MultiPolygon":
        return [poly[0] for poly in geometry["coordinates"]]
    return []


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))

    # Collect exterior rings with their ISO code, limited to the map window.
    shapes = []
    for feature in data["features"]:
        props = feature["properties"]
        iso = props.get("ADM0_A3") or props.get("ISO_A3")
        for ring in polygons(feature["geometry"]):
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            if max(xs) < LON_MIN or min(xs) > LON_MAX or max(ys) < LAT_MIN or min(ys) > LAT_MAX:
                continue
            shapes.append((iso, ring))

    width = int((LON_MAX - LON_MIN) * SCALE)
    height = int((LAT_MAX - LAT_MIN) * SCALE)

    dots = []
    lat = LAT_MAX - STEP / 2
    while lat > LAT_MIN:
        lon = LON_MIN + STEP / 2
        while lon < LON_MAX:
            hit = None
            for iso, ring in shapes:
                if ring_contains(ring, lon, lat):
                    hit = iso
                    break
            if hit is not None:
                if hit in MIDDLE_EAST or hit in AFRICA:
                    colour = GOLD
                else:
                    colour = GREY
                cx = (lon - LON_MIN) * SCALE
                cy = (LAT_MAX - lat) * SCALE
                dots.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{DOT_R}" fill="{colour}"/>')
            lon += STEP
        lat -= STEP

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="map-title">',
        '<title id="map-title">Dot map of the Middle East and Africa, with MFT focus markets highlighted in gold</title>',
        *dots,
        "</svg>",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(svg) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(dots)} dots")


if __name__ == "__main__":
    main()
