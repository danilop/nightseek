#!/usr/bin/env python3
"""Cache NED galaxy metadata for the static app (NED does not allow browser CORS).
Public API, no credentials. Serial requests; retain good old records on partial failures.
"""
import json
import math
import pathlib
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'web/src/data/ned-galaxies.json'
TARGETS = ['M31', 'M32', 'M33', 'M51', 'M63', 'M64', 'M65', 'M66', 'M81', 'M82', 'M87', 'M101', 'M104', 'M106', 'M110', 'NGC 253', 'NGC 891', 'NGC 2403', 'NGC 4565', 'NGC 5128']
NS = {'v': 'http://www.ivoa.net/xml/VOTable/v1.3'}

def parse_ned(xml, target, fetched_at):
    root = ET.fromstring(xml)
    table = root.find('.//v:TABLE', NS)
    if table is None:
        raise ValueError('Missing NED result')
    rows = table.findall('.//v:TR', NS)
    if len(rows) != 1:
        raise ValueError('NED did not resolve one object')
    fields = table.findall('v:FIELD', NS)
    values = dict(zip([f.get('ID') for f in fields], [c.text for c in rows[0].findall('v:TD', NS)]))
    def num(key):
        value = values.get(key)
        if value in (None, ''):
            return None
        result = float(value)
        if not math.isfinite(result):
            raise ValueError('Non-finite NED value')
        return result
    distance = num('mean_distance')
    if values.get('ptype') not in ('G', 'GPair', 'GTrpl') or distance is not None and distance <= 0:
        raise ValueError('Unexpected galaxy type or distance')
    return {'name': target, 'aliases': (values.get('CrossID_list') or '').split('; '),
            'raDegrees': num('equ_j2000_lon'), 'decDegrees': num('equ_j2000_lat'),
            'distanceMpc': distance, 'distanceSemMpc': num('SEM_distance'),
            'distanceMethod': 'NED mean of redshift-independent measurements; SEM is not total uncertainty',
            'redshift': num('z'), 'redshiftReference': values.get('z_refcode'),
            'morphology': values.get('o_class_morph'), 'morphologyReference': values.get('morph_refcode'),
            'diameterArcsec': num('o_diam_maj_dia'), 'diameterBand': values.get('o_diam_passband'),
            'diameterReference': values.get('diameter_refcode'), 'fetchedAt': fetched_at,
            'sourceUrl': 'https://ned.ipac.caltech.edu/NED::API/OverviewOfObject?' + urllib.parse.urlencode({'TARGET': target})}

def main():
    previous = json.loads(DEST.read_text()) if DEST.exists() else {'galaxies': []}
    records = {r['name']: r for r in previous['galaxies']}
    errors = []
    now = datetime.now(timezone.utc)
    for target in TARGETS:
        old = records.get(target)
        if old and (now - datetime.fromisoformat(old['fetchedAt'])).total_seconds() < 7 * 86400:
            continue
        try:
            url = 'https://ned.ipac.caltech.edu/NED::API/OverviewOfObject?' + urllib.parse.urlencode({'TARGET': target})
            request = urllib.request.Request(url, headers={'User-Agent': 'NightSeek/1.0 (https://github.com/danilop/nightseek)'})
            with urllib.request.urlopen(request, timeout=30) as response:
                records[target] = parse_ned(response.read(), target, now.isoformat())
            print('NED:', target, records[target]['distanceMpc'], flush=True)
        except Exception as error:
            errors.append(f'{target}: {error}')
            print(f'::warning::NED {target}: {error}', flush=True)
        time.sleep(.25)
    DEST.write_text(json.dumps({'checkedAt': now.isoformat(), 'galaxies': list(records.values()), 'errors': errors}, indent=2) + '\n')
    if not records:
        raise SystemExit('No NED galaxy records available')

if __name__ == '__main__':
    main()
