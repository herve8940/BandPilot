export type LibraryFile = {kind: 'scene' | 'channel-preset' | 'fx' | 'native-scene'; name: string; data: unknown};
/** Detect the format independently of the filename. The API validates every setting. */
export function parseLibraryFile(filename: string, text: string): LibraryFile {
  if (new TextEncoder().encode(text).length > 900000) throw Error('Fichier trop volumineux');
  if (filename.toLowerCase().endsWith('.scn')) return {kind: 'native-scene', name: filename.slice(0,120), data: text};
  let value;
  try { value = JSON.parse(text); } catch { throw Error('Fichier JSON illisible.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Ce fichier n’est pas une scène ou un preset BandPilot.');
  if (value.format === 'bandpilot-channel-preset') value = {kind: 'channel-preset', data: value};
  else if (value.version && ['console','application'].includes(value.scope)) value = {kind: 'scene', data: value};
  if (!['scene','channel-preset','fx'].includes(value.kind) || value.data === undefined) throw Error('Ce fichier n’est pas une scène ou un preset BandPilot.');
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : filename.replace(/\.json$/i,'');
  return {kind: value.kind, name: name.slice(0,120), data: value.data};
}
