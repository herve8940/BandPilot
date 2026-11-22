// Personal display preferences only. Keep them independent of the HTTP port.
const {readFileSync, writeFileSync, renameSync} = require('node:fs');
const {join} = require('node:path');
const LIMIT = 128 * 1024;
function valid(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 60 && entries.every(([key, layout]) =>
    /^[A-Za-z0-9_-]+:(small|medium|wide)$/.test(key) && layout &&
    typeof layout === 'object' && !Array.isArray(layout) &&
    Object.keys(layout).every(k => ['hidden', 'outputs', 'density', 'banks', 'activeBank'].includes(k)) &&
    Array.isArray(layout.hidden) && layout.hidden.length <= 80 && layout.hidden.every(id => typeof id === 'string' && id.length <= 40) &&
    typeof layout.outputs === 'boolean' && ['compact', 'comfortable'].includes(layout.density) &&
    (layout.activeBank === undefined || typeof layout.activeBank === 'string' && layout.activeBank.length <= 80) &&
    (layout.banks === undefined || Array.isArray(layout.banks) && layout.banks.length <= 12 && layout.banks.every(bank =>
      bank && typeof bank.id === 'string' && /^bank-[\w-]{1,72}$/.test(bank.id) &&
      typeof bank.name === 'string' && bank.name.trim().length > 0 && bank.name.length <= 40 &&
      (bank.mix===undefined||Number.isInteger(bank.mix)&&bank.mix>=0&&bank.mix<=6) &&
      (bank.compactStrips===undefined||typeof bank.compactStrips==='boolean') &&
      Array.isArray(bank.strips) && bank.strips.length <= 80 && bank.strips.every(id => typeof id === 'string' && id.length <= 40))));
}
function workspaceStore(directory) {
  const file = join(directory, 'mixer-workspaces.json');
  return {
    get() {
      try { const raw = readFileSync(file, 'utf8'); if (raw.length > LIMIT) return null; const value = JSON.parse(raw); return valid(value) ? value : null; }
      catch { return null; }
    },
    set(value) {
      if (!valid(value)) return false;
      const raw = JSON.stringify(value); if (raw.length > LIMIT) return false;
      try { writeFileSync(file + '.tmp', raw, {mode: 0o600}); renameSync(file + '.tmp', file); return true; }
      catch { return false; }
    }
  };
}
module.exports = {workspaceStore};
