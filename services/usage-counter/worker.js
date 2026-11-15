// BandPilot anonymous usage counter (Cloudflare Worker + D1).
// Stores, per day, the random installation number with version, platform,
// channel and mixer model. No IP address, no headers, nothing else is kept.
// POST /v1/ping          : one message from the application
// GET  /v1/stats?days=30 : totals, protected by the STATS_TOKEN secret

const PLATFORMS = new Set(['windows', 'macos', 'linux', 'android', 'other']);
const CHANNELS = new Set(['release', 'source']);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TEXT = /^[A-Za-z0-9 _.+-]{1,32}$/;
const RETENTION_DAYS = 400;

const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
const today = () => new Date().toISOString().slice(0, 10);
const shift = (day, delta) => new Date(Date.parse(day + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10);

export function validReport(value, now = today()) {
  if (!value || typeof value !== 'object' || value.schema !== 1) return null;
  const {id, day, version, platform, channel, model} = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  // The device clock may be a little off; anything else is refused.
  if (typeof day !== 'string' || !DAY.test(day) || day < shift(now, -1) || day > shift(now, 1)) return null;
  if (typeof version !== 'string' || !TEXT.test(version)) return null;
  if (!PLATFORMS.has(platform) || !CHANNELS.has(channel)) return null;
  if (typeof model !== 'string' || !TEXT.test(model)) return null;
  return {id, day, version, platform, channel, model};
}

// The table is created on first use and old rows are cleaned once a day,
// so the counter works without any console command or scheduled trigger.
let readyDay = '';
async function prepare(env) {
  if (readyDay === today()) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pings (day TEXT NOT NULL, id TEXT NOT NULL, version TEXT NOT NULL, platform TEXT NOT NULL, channel TEXT NOT NULL, model TEXT NOT NULL, PRIMARY KEY (day, id))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS pings_id ON pings (id)'),
    env.DB.prepare('DELETE FROM pings WHERE day < ?1').bind(shift(today(), -RETENTION_DAYS)),
  ]);
  readyDay = today();
}

async function ping(request, env) {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > 2048) return json({error: 'too large'}, 413);
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({error: 'invalid'}, 400); }
  const report = validReport(body);
  if (!report) return json({error: 'invalid'}, 400);
  await prepare(env);
  await env.DB.prepare('INSERT OR IGNORE INTO pings (day, id, version, platform, channel, model) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(report.day, report.id, report.version, report.platform, report.channel, report.model).run();
  return new Response(null, {status: 204});
}

async function stats(request, env) {
  const token = request.headers.get('Authorization') ?? '';
  if (!env.STATS_TOKEN || token !== 'Bearer ' + env.STATS_TOKEN) return json({error: 'unauthorized'}, 401);
  await prepare(env);
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 30));
  const from = shift(today(), -(days - 1));
  const all = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results;
  const [installs] = await all("SELECT COUNT(DISTINCT id) AS total FROM pings WHERE day >= ?1 AND channel = 'release'", from);
  return json({
    from, to: today(),
    installations: installs.total,
    daily: await all("SELECT day, COUNT(*) AS active FROM pings WHERE day >= ?1 AND channel = 'release' GROUP BY day ORDER BY day", from),
    newInstallations: await all("SELECT first AS day, COUNT(*) AS count FROM (SELECT id, MIN(day) AS first FROM pings WHERE channel = 'release' GROUP BY id) WHERE first >= ?1 GROUP BY first ORDER BY first", from),
    platforms: await all("SELECT platform, COUNT(DISTINCT id) AS installations FROM pings WHERE day >= ?1 AND channel = 'release' GROUP BY platform ORDER BY installations DESC", from),
    versions: await all("SELECT version, COUNT(DISTINCT id) AS installations FROM pings WHERE day >= ?1 AND channel = 'release' GROUP BY version ORDER BY installations DESC", from),
    models: await all("SELECT model, COUNT(DISTINCT id) AS installations FROM pings WHERE day >= ?1 AND channel = 'release' GROUP BY model ORDER BY installations DESC", from),
    fromSource: (await all("SELECT COUNT(DISTINCT id) AS total FROM pings WHERE day >= ?1 AND channel = 'source'", from))[0].total,
  });
}

export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname === '/v1/ping' && request.method === 'POST') return ping(request, env);
    if (pathname === '/v1/stats' && request.method === 'GET') return stats(request, env);
    return json({error: 'not found'}, 404);
  },
  // Optional daily clean-up (the same clean-up also runs on the first request of each day).
  async scheduled(event, env) {
    readyDay = '';
    await prepare(env);
  },
};
