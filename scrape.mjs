// Runs in GitHub Actions (Node 18+, no dependencies). Writes data.json next to the page.
import { writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://www.cinemacity.sk/sk/data-api-service/v1/quickbook/10105/';
const PATHS = [
  'film-events-dates/in-cinema/{id}/as-at-date/{d}?attr=&lang=sk_SK',
  'film-events/in-cinema/{id}/at-date/{d}?attr=&lang=sk_SK',
];
const CINEMAS = { aup: 1012, eur: 1010 };
const DAYS = 12; // Lumière shows ~10; the page ignores extra Cinema City days

const out = { fetchedAt: new Date().toISOString(), lum: null, cc: { aup: {}, eur: {} }, errors: [] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, json) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'text/html', 'accept-language': 'sk' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

try {
  out.lum = (await get('https://www.kino-lumiere.sk/')).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
} catch (e) { out.errors.push('lumiere: ' + e.message); }

for (const [name, id] of Object.entries(CINEMAS)) {
  for (let i = 0; i < DAYS; i++) {
    const date = new Date(Date.now() + i * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });
    let last;
    for (const p of PATHS) {
      try {
        const j = await get(BASE + p.replace('{id}', id).replace('{d}', date), true);
        if (!Array.isArray((j.body || j).events)) throw new Error('no events array');
        out.cc[name][date] = j; last = null; break;
      } catch (e) { last = e; }
    }
    if (last) out.errors.push(`${name} ${date}: ${last.message}`);
    await sleep(300);
  }
}

const got = out.lum || Object.values(out.cc).some(c => Object.keys(c).length);
if (!got) { console.error('Nothing fetched:', out.errors); process.exit(1); } // keep the previous data.json
await writeFile('data.json', JSON.stringify(out));
console.log('ok', out.errors.length, 'errors');
