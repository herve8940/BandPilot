import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {EAR_GROUP_RANGE,type EarGroup} from '../shared/ear-group.js';
import {fromWire,toWire} from './parameters.js';

export class EarGroups {
  private offsets = new Map<string, number>();

  constructor(private db: Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS ear_groups (
      id TEXT PRIMARY KEY, share_id TEXT NOT NULL, name TEXT NOT NULL,
      members TEXT NOT NULL, revision INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS ear_groups_owner ON ear_groups(share_id)`);
  }

  list(owner: string): EarGroup[] {
    const rows = this.db.prepare('SELECT id,name,members,revision FROM ear_groups WHERE share_id=? ORDER BY rowid')
      .all(owner) as {id:string; name:string; members:string; revision:number}[];
    return rows.map(row => ({...row, members:JSON.parse(row.members), offset:this.offsets.get(row.id) ?? 0}));
  }

  clearOffsets(owner?: string) {
    if (owner === undefined) this.offsets.clear();
    else for (const group of this.list(owner)) this.offsets.delete(group.id);
  }

  setOffset(id: string, offset: number) { this.offsets.set(id, offset); }

  edit(owner: string, id: string | undefined, data: Record<string,unknown>, allowed: string[], remove: boolean) {
    const existing = id ? this.list(owner).find(group => group.id === id) : undefined;
    if (id && (!existing || existing.revision !== data.revision)) throw Error('Le groupe a changé. Rouvre son éditeur.');
    if (remove && existing) {
      this.db.prepare('DELETE FROM ear_groups WHERE id=? AND share_id=?').run(id,owner);
      this.offsets.delete(existing.id);
      return;
    }
    const {name,members} = data;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw Error('Nom du groupe invalide');
    if (!Array.isArray(members) || !members.length || new Set(members).size !== members.length ||
        !members.every(prefix => typeof prefix === 'string' && allowed.includes(prefix))) throw Error('Sélection d’entrées invalide');
    if (existing) {
      this.db.prepare('UPDATE ear_groups SET name=?,members=?,revision=revision+1 WHERE id=?')
        .run(name.trim(),JSON.stringify(members),existing.id);
      if (existing.members.length !== members.length || !members.every(member => existing.members.includes(member))) this.offsets.delete(existing.id);
    } else {
      if (this.list(owner).length >= 32) throw Error('32 groupes maximum');
      this.db.prepare('INSERT INTO ear_groups VALUES(?,?,?,?,1)').run(randomUUID(),owner,name.trim(),JSON.stringify(members));
    }
  }
}

/** Use one common dB delta so a ceiling never changes the balance within the group. */
export function planEarGroupMove(levels: Map<string,number>, offset: number, target: unknown, cap:number, maxRaise:number) {
  if (typeof target !== 'number' || !Number.isFinite(target) || Math.abs(target) > EAR_GROUP_RANGE) throw Error('Position de groupe invalide');
  let delta = target - offset;
  const audible = [...levels].filter(([,v]) => v > 0);
  if (!audible.length) delta = 0;
  for (const [address,wire] of audible) {
    const db = Number(fromWire(address,wire));
    if (delta > 0) delta = Math.min(delta, Math.max(0,Number(fromWire(address,Math.min(cap,wire+maxRaise))) - db));
    // Do not let a group gesture push an audible member into digital silence.
    if (delta < 0) delta = Math.max(delta, Math.min(0,Number(fromWire(address,1/160)) - db));
  }
  const writes = new Map<string,number>();
  if (Math.abs(delta) > .0001) for (const [address,wire] of audible) {
    const db = Number(fromWire(address,wire)) + delta;
    const next = Number(toWire(address,db));
    if(next>cap+.000001)throw Error('Un niveau dépasse le plafond du retour. Abaisse-le individuellement.');
    writes.set(address,Math.round(next * 10000) / 10000);
  }
  return {offset: offset+delta, writes};
}
