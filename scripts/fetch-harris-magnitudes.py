#!/usr/bin/env python3
"""Bundle Harris 1996 (2010 edition) integrated V magnitudes, with attribution.
Free redistribution without a fee, referring users to the original source.
Run manually when reviewing a new edition; this is not live photometry.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re
import urllib.request

SOURCE = 'https://physics.mcmaster.ca/~harris/mwgc.dat'
DEST = pathlib.Path(__file__).resolve().parents[1] / 'web/src/data/harris-magnitudes.json'


def parse_catalog(text):
    positions, magnitudes = {}, {}
    part = 0
    for line in text.splitlines():
        if 'Part I: ' in line:
            part = 1
        elif 'Part II: ' in line:
            part = 2
        elif 'Part III: ' in line:
            part = 3
        match = re.fullmatch(r'(NGC|IC)\s+(\d+)', line[:11].strip())
        if not match:
            continue
        name = match[1] + str(int(match[2]))
        if part == 1:
            coords = line[23:49].split()
            if len(coords) != 6:
                raise ValueError(f'Invalid coordinates: {name}')
            h, m, s = map(float, coords[:3])
            d, dm, ds = map(float, coords[3:])
            positions[name] = [(h + m / 60 + s / 3600) * 15,
                               (-1 if coords[3].startswith('-') else 1) * (abs(d) + dm / 60 + ds / 3600)]
        elif part == 2 and line[40:46].strip():
            value = float(line[40:46])
            if not math.isfinite(value) or not -5 <= value <= 30:
                raise ValueError(f'Invalid integrated V magnitude: {name}')
            magnitudes[name] = value
    result = {name: {'raDegrees': round(positions[name][0], 7),
                     'decDegrees': round(positions[name][1], 7), 'vMagnitude': mag}
              for name, mag in sorted(magnitudes.items()) if name in positions}
    if len(result) < 80 or result.get('NGC104', {}).get('vMagnitude') != 3.95:
        raise ValueError('Unexpected Harris catalogue layout or incomplete data')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=pathlib.Path)
    args = parser.parse_args()
    raw = args.input.read_bytes() if args.input else urllib.request.urlopen(SOURCE, timeout=30).read()
    result = {'source': SOURCE, 'citation': 'Harris 1996 (2010 edition)',
              'band': 'integrated V', 'sha256': hashlib.sha256(raw).hexdigest(),
              'clusters': parse_catalog(raw.decode())}
    DEST.write_text(json.dumps(result, indent=2) + '\n')
    print(f"Bundled {len(result['clusters'])} integrated V magnitudes")


if __name__ == '__main__':
    main()
