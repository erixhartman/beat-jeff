"""In-season refresh, run by .github/workflows/update.yml.

1. Finds the season's league on its own from the league's permanent Yahoo address, and does nothing until
   Yahoo has renewed it and the draft is done. Eric's team is the one marked Commissioner; Jeff's is found by name.
2. Then, every morning: this week's matchup for Eric, two-start pitchers from MLB's probables, and any newly
   finished weeks appended to data/weekly_stats_<season>.csv. When a week finishes (Monday), it also rebuilds
   the roto standings and extends the Beat Jeff scoreboard. Public pages only; no logins, no keys.
"""
import csv, datetime, json, os, re, time, urllib.request
from bs4 import BeautifulSoup
import build_jeff, build_roto, collections

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36'}
CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']
OUT = '../public/data'
TODAY = datetime.date.today()
STAMP = TODAY.strftime('%b %-d, %Y')

def get(url):
    req = urllib.request.Request(url, headers=UA)
    html = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    time.sleep(0.6)
    return html

def find_league(slug, season):
    ids = collections.Counter(re.findall(r'b1/(\d{3,8})', get(f'https://baseball.fantasysports.yahoo.com/league/{slug}/{season}')))
    return int(ids.most_common(1)[0][0]) if ids else None


def team_list(base):
    out = {}
    for tr in BeautifulSoup(get(base + '/teams'), 'html.parser').select('table tr'):
        for a in tr.select('a[href*="/b1/"]'):
            m = re.search(r'/b1/\d+/(\d{1,2})(?:$|[/?])', a['href'])
            if m and a.get_text(strip=True):
                out[int(m.group(1))] = {'name': a.get_text(strip=True), 'commissioner': 'Commissioner' in tr.get_text()}
                break
    return out


def matchup_rows(html):
    s = BeautifulSoup(html, 'html.parser')
    t = [t for t in s.find_all('table') if t.find('th') and 'H/AB*' in t.get_text()]
    if not t: return []
    out = []
    for tr in t[0].find_all('tr')[1:3]:
        c = [x.get_text(strip=True) for x in tr.find_all(['td', 'th'])]
        out.append(dict(zip(['team', 'HAB'] + CATS[:6] + ['IP'] + CATS[6:], c[:15])))
    return out

def two_starters():
    mon = TODAY - datetime.timedelta(days=TODAY.weekday()); sun = mon + datetime.timedelta(days=6)
    url = f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate={mon}&endDate={sun}&hydrate=probablePitcher,team'
    d = json.load(urllib.request.urlopen(url, timeout=60))
    starts = {}
    for day in d.get('dates', []):
        for g in day['games']:
            for side in ('home', 'away'):
                p = g['teams'][side].get('probablePitcher')
                if not p: continue
                team = g['teams'][side]['team'].get('abbreviation', g['teams'][side]['team']['name'])
                e = starts.setdefault(p['id'], {'name': p['fullName'], 'team': team, 'dates': []})
                e['dates'].append(datetime.date.fromisoformat(day['date']).strftime('%a %b %-d'))
    return sorted([v for v in starts.values() if len(v['dates']) >= 2], key=lambda v: v['name'])

def main():
    cfg = json.load(open('config.json'))
    y = cfg['season']
    lid = cfg.get('league_id') or find_league(cfg['league_slug'], y)
    if not lid:
        print(f'waiting: Yahoo has not renewed the league for {y} yet'); return
    base = f'https://baseball.fantasysports.yahoo.com/{y}/b1/{lid}'
    if len(re.findall(r'/mlb/players/\d+', get(base + '/draftresults'))) < 200:
        print('waiting: the draft has not happened yet'); return
    teams = team_list(base)
    me_id = str(cfg.get('eric_team') or next((i for i, t in teams.items() if t['commissioner']), ''))
    jeff_id = str(next((i for i, t in teams.items() if t['name'] == cfg['jeff_name']), cfg.get('jeff_team')))
    cfg['eric_name'] = teams.get(int(me_id), {}).get('name') if me_id else None
    cfg['jeff_name'] = teams.get(int(jeff_id), {}).get('name', cfg['jeff_name'])
    home = get(base)
    links = sorted(set(re.findall(r'matchup\?week=(\d+)&mid1=(\d+)&mid2=(\d+)', home)))
    if not links:
        print('no matchups listed yet'); return
    cur = max(int(w) for w, _, _ in links)
    me = me_id

    # this week
    mine = next(((a, b) for w, a, b in links if int(w) == cur and me in (a, b)), None)
    week = {'status': 'live', 'updated': STAMP, 'week': cur}
    if mine:
        rows = matchup_rows(get(f'{base}/matchup?week={cur}&mid1={mine[0]}&mid2={mine[1]}'))
        if len(rows) == 2:
            first_is_me = mine[0] == me
            week['me'], week['them'] = (rows[0], rows[1]) if first_is_me else (rows[1], rows[0])
            week['opponent'] = week['them']['team']
    try: week['twoStart'] = two_starters()
    except Exception as e: print('probables failed', e)
    json.dump(week, open(f'{OUT}/week.json', 'w'), separators=(',', ':'))

    # finished weeks -> weekly stats for the scoreboard
    path = f'data/weekly_stats_{y}.csv'
    have = set()
    if os.path.exists(path):
        have = {int(r['week']) for r in csv.DictReader(open(path))}
    new = []
    for w in range(1, min(cur, cfg.get('regular_weeks', 22) + 1)):
        if w in have: continue
        page = get(f'{base}?matchup_week={w}&module=matchups')
        for a, b in sorted(set(re.findall(r'matchup\?week=%d&mid1=(\d+)&mid2=(\d+)' % w, page))):
            for r in matchup_rows(get(f'{base}/matchup?week={w}&mid1={a}&mid2={b}')):
                new.append([y, w] + [r.get(k, '') for k in ['team', 'HAB'] + CATS[:6] + ['IP'] + CATS[6:]])
    if new:
        exists = os.path.exists(path)
        with open(path, 'a', newline='') as f:
            wr = csv.writer(f)
            if not exists: wr.writerow(['season', 'week', 'team', 'HAB', 'R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'IP', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB'])
            wr.writerows(new)

    # a week finished: roto standings and the Beat Jeff scoreboard
    if new and os.path.exists(path):
        build_roto.build(path, y, set(range(1, cfg.get('regular_weeks', 22) + 1)))
    if new and os.path.exists(path) and cfg.get('eric_name') and cfg.get('jeff_name'):
        past = build_jeff.build()
        reg = {y: set(range(1, cfg.get('regular_weeks', 22) + 1))}
        now = build_jeff.build(path, {y: cfg['eric_name']}, {y: cfg['jeff_name']}, reg)
        json.dump({'seasons': past + now, 'updated': STAMP}, open(f'{OUT}/jeff.json', 'w'), separators=(',', ':'))
    print('week', cur, 'updated')

if __name__ == '__main__':
    main()
