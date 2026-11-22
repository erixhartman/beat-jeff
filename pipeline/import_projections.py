"""Read Eric's 2027 projections from a spreadsheet and match every row to a player.

    python import_projections.py ~/Downloads/eric-2027-projections.xlsx
    python build_values.py --projections data/projections.json   # rankings, board and trade checker switch to 2027
    python build_board.py

The workbook needs a Hitters sheet and a Pitchers sheet (see projections_template.xlsx). Column names are
flexible: "Player" or "Name", "SO" or "K", and so on. Rows are matched to MLB players by MLBAM ID when the
sheet has one, otherwise by name, using the team to tell apart players with the same name. Anything that
can't be matched cleanly is listed at the end and still kept, so a rookie or a player from Japan isn't lost.
"""
import argparse, collections, json, re, sys, unicodedata
import openpyxl

ALIASES = {
    'name': ['name', 'player', 'playername', 'player name'],
    'team': ['team', 'tm', 'mlbteam', 'org'],
    'id': ['mlbam', 'mlbamid', 'mlbam id', 'mlbid', 'id', 'playerid', 'player id', 'xmlbamid'],
    'pos': ['pos', 'position', 'positions', 'elig', 'eligibility'],
    'pa': ['pa'], 'ab': ['ab'], 'R': ['r', 'runs'], 'HR': ['hr'], 'RBI': ['rbi'], 'SB': ['sb'],
    'AVG': ['avg', 'ba'], 'OBP': ['obp'], 'SLG': ['slg'], 'OPS': ['ops'],
    'ip': ['ip'], 'W': ['w', 'wins'], 'SV': ['sv', 'saves'], 'K': ['k', 'so', 'strikeouts'], 'BB': ['bb', 'walks'],
    'ERA': ['era'], 'WHIP': ['whip'], 'KBB': ['k/bb', 'kbb', 'k-bb ratio', 'k:bb'], 'gs': ['gs'], 'g': ['g', 'games'],
}


def norm(n):
    n = unicodedata.normalize('NFKD', str(n)).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'\(.*?\)', '', n)
    n = re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?', '', n)
    return re.sub(r'[^a-z]', '', n)


def read_sheet(ws):
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and any(str(c or '').strip().lower() in ALIASES['name'] for c in r))
    head = [str(c or '').strip().lower() for c in rows[hi]]
    col = {}
    for key, names in ALIASES.items():
        for i, h in enumerate(head):
            if h in names and key not in col: col[key] = i
    out = []
    for r in rows[hi + 1:]:
        if not r or not r[col['name']]: continue
        out.append({k: r[i] for k, i in col.items()})
    return out, col


def f(x):
    try: return float(str(x).replace(',', ''))
    except Exception: return None


def index():
    """Every 2026 MLB player we know: normalized name -> [(id, name, team abbreviation)]."""
    teams = json.load(open('raw/mlb/teams.json'))
    idx, byid = collections.defaultdict(list), {}
    for g in ('hitting', 'pitching'):
        for s in json.load(open(f'raw/mlb/{g}_2026.json'))['stats'][0]['splits']:
            p = s['player']; tm = teams.get(s.get('team', {}).get('name', ''), '')
            if p['id'] in byid: continue
            byid[p['id']] = (p['id'], p['fullName'], tm)
            idx[norm(p['fullName'])].append(byid[p['id']])
    return idx, byid


def match(row, idx, byid):
    if row.get('id') and f(row['id']) and int(f(row['id'])) in byid:
        return byid[int(f(row['id']))], None
    hits = idx.get(norm(row['name']), [])
    if len(hits) == 1: return hits[0], None
    if len(hits) > 1:
        tm = str(row.get('team') or '').upper()
        same = [h for h in hits if h[2] == tm]
        if len(same) == 1: return same[0], None
        return None, f"{row['name']}: {len(hits)} players share this name; add a team or MLBAM ID"
    return None, f"{row['name']}: no 2026 MLB match (new to MLB?), kept with the sheet's own position"


def hitter(row, m):
    ab = f(row.get('ab')) or (f(row.get('pa')) or 0) * 0.89
    ops = f(row.get('OPS')) or ((f(row.get('OBP')) or 0) + (f(row.get('SLG')) or 0))
    return {'id': m[0] if m else None, 'name': m[1] if m else str(row['name']).strip(), 'team': (m[2] if m else '') or str(row.get('team') or ''),
            'ab': round(ab), 'pa': round(f(row.get('pa')) or ab / 0.89), 'R': f(row.get('R')) or 0, 'HR': f(row.get('HR')) or 0,
            'RBI': f(row.get('RBI')) or 0, 'SB': f(row.get('SB')) or 0, 'AVG': f(row.get('AVG')) or 0, 'OPS': ops,
            'OBP': f(row.get('OBP')) or 0, 'SLG': f(row.get('SLG')) or 0, 'g': f(row.get('g')) or 0,
            'sheetPos': [p.strip() for p in re.split(r'[,/ ]+', str(row.get('pos') or '')) if p.strip()]}


def pitcher(row, m):
    ip = f(row.get('ip')) or 0; k = f(row.get('K')) or 0
    bb = f(row.get('BB')) or (k / f(row.get('KBB')) if f(row.get('KBB')) else 0)
    whip = f(row.get('WHIP')) or 0
    return {'id': m[0] if m else None, 'name': m[1] if m else str(row['name']).strip(), 'team': (m[2] if m else '') or str(row.get('team') or ''),
            'ip': ip, 'ipDisp': f"{ip:.0f}", 'W': f(row.get('W')) or 0, 'SV': f(row.get('SV')) or 0, 'K': k, 'BB': round(bb, 1),
            'ERA': f(row.get('ERA')) or 0, 'WHIP': whip, 'KBB': round(k / bb, 2) if bb else k, 'HLD': 0,
            'gs': f(row.get('gs')), 'g': f(row.get('g')),
            'sheetPos': [p.strip() for p in re.split(r'[,/ ]+', str(row.get('pos') or '')) if p.strip()]}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('xlsx'); ap.add_argument('--label', default="Eric's 2027 projections")
    a = ap.parse_args()
    wb = openpyxl.load_workbook(a.xlsx, data_only=True)
    names = {n.lower(): n for n in wb.sheetnames}
    sh = next((names[n] for n in names if n.startswith('hit') or n.startswith('bat')), None)
    sp = next((names[n] for n in names if n.startswith('pit')), None)
    if not sh or not sp: sys.exit(f'Need a Hitters sheet and a Pitchers sheet; found {wb.sheetnames}')
    idx, byid = index()
    out, notes = {'source': a.label, 'hitters': [], 'pitchers': []}, []
    for sheet, key, build, need in ((sh, 'hitters', hitter, ['R', 'HR', 'RBI', 'SB', 'AVG']), (sp, 'pitchers', pitcher, ['ip', 'W', 'SV', 'K', 'ERA', 'WHIP'])):
        rows, col = read_sheet(wb[sheet])
        missing = [c for c in need if c not in col] + ([] if key == 'pitchers' or 'ab' in col or 'pa' in col else ['AB or PA']) \
                  + ([] if key == 'hitters' or 'BB' in col or 'KBB' in col else ['BB or K/BB']) \
                  + ([] if key == 'pitchers' or 'OPS' in col or ('OBP' in col and 'SLG' in col) else ['OPS (or OBP and SLG)'])
        if missing: sys.exit(f'{sheet} sheet is missing: {", ".join(missing)}')
        seen = set()
        for r in rows:
            m, why = match(r, idx, byid)
            if why: notes.append(why)
            p = build(r, m)
            k2 = p['id'] or norm(p['name'])
            if k2 in seen: notes.append(f"{p['name']}: listed twice in {sheet}; kept the first"); continue
            seen.add(k2); out[key].append(p)
    json.dump(out, open('data/projections.json', 'w'), ensure_ascii=False)
    print(f"{len(out['hitters'])} hitters, {len(out['pitchers'])} pitchers -> data/projections.json")
    if notes: print('Check these:\n  ' + '\n  '.join(notes))


if __name__ == '__main__':
    main()
