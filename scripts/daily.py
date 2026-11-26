"""Duk of the day: python site/scripts/daily.py -> site/assets/daily.json (sync-content.py runs it every pass).

Today's pick (utc date) is written down once and never changes after that, so daily.html can show every past day
even when the archive grows. The pick is the one app.js dukDailyPick() makes: the curated archive (assets/media.json
memes without 'created'), minus anything whose title/alt breaks the content rule, sorted by src, then
pool[(days since 1970-01-01 utc * 7919) % len(pool)]. Prints whether it added a day.
"""
from datetime import datetime, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json

SITE = Path(__file__).resolve().parents[1]
MEDIA = SITE / 'assets' / 'media.json'
DAILY = SITE / 'assets' / 'daily.json'

_spec = spec_from_file_location('sync_content', SITE / 'scripts' / 'sync-content.py')
sync = module_from_spec(_spec)
_spec.loader.exec_module(sync)


def pool() -> list:
    memes = json.loads(MEDIA.read_text(encoding='utf-8')).get('memes', [])
    clean = [meme for meme in memes if meme.get('src') and not meme.get('created')
             and not sync.OFF_RULE.search(f"{meme.get('title') or ''} {meme.get('alt') or ''}")]
    return sorted(clean, key=lambda meme: meme['src'])


def main() -> None:
    now = datetime.now(timezone.utc)
    today = now.strftime('%Y-%m-%d')
    daily = json.loads(DAILY.read_text(encoding='utf-8')) if DAILY.is_file() else {'days': []}
    if any(day['date'] == today for day in daily['days']):
        print(f'duk of the day: {today} already picked')
        return
    memes = pool()
    if not memes:
        raise SystemExit('duk of the day: no memes to pick from')
    pick = memes[(now.date() - datetime(1970, 1, 1).date()).days * 7919 % len(memes)]
    daily['days'].insert(0, {'date': today, 'src': pick['src'], 'thumb': pick.get('thumb') or pick['src'],
                             'title': pick.get('title') or 'just duk.', 'alt': pick.get('alt') or ''})
    daily['days'].sort(key=lambda day: day['date'], reverse=True)
    DAILY.write_text(json.dumps(daily, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f"duk of the day: {today} -> {pick['src']}")


if __name__ == '__main__':
    main()
