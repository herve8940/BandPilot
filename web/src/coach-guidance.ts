/** Suggest a navigation step, never a mixer command. Unknown/stale values are not silence. */
export type CoachMeter = { channel: number; name: string; db: number | null };
export type CoachCalibration = {channel:number;name:string;state:'todo'|'ok'|'stale'};
export type CoachNext = { step: 'connect' | 'inputs' | 'levels' | 'tone' | 'ears' | 'save'; title: string; why: string; action: string; channel?: number; tone: 'neutral' | 'warn' };
export function coachNext(input: { simulation: boolean; connected: boolean; online: boolean; inputs: number; completed: string[]; meters: CoachMeter[]; calibration?:CoachCalibration[]|null }): CoachNext {
  if (!input.online || (!input.simulation && !input.connected)) return { step:'connect', title:'Retrouver la connexion', why:'Les conseils restent consultables. Vérifie la liaison avant de mesurer ou de préparer un changement.', action:'Vérifier la connexion', tone:'warn' };
  if (!input.inputs) return { step:'inputs', title:'Décrire ton groupe', why:'Indique quel instrument est branché sur chaque entrée pour recevoir des conseils adaptés.', action:'Préparer mes instruments', tone:'neutral' };
  const loudest = input.meters.filter(m => m.db !== null && Number.isFinite(m.db)).sort((a,b) => b.db! - a.db!)[0];
  if (!input.simulation && loudest && loudest.db! >= -1) return { step:'levels', title:`Vérifier le niveau de ${loudest.name}`, why:'Un niveau reçu approche 0 dBFS. Vérifie la source et mesure le passage fort avant de choisir une correction.', action:'Ouvrir le contrôle des niveaux', channel:loudest.channel, tone:'warn' };
  if (!input.simulation && input.calibration !== undefined) {
    if (input.calibration === null) return { step:'levels', title:'Vérifier les mesures du groupe', why:'La validité des mesures n’est pas encore confirmée. Les étapes cochées ne remplacent pas la calibration de chaque instrument.', action:'Vérifier les niveaux', tone:'neutral' };
    const stale = input.calibration.find(c=>c.state==='stale');
    if (stale) return { step:'levels', title:`Refaire la mesure de ${stale.name}`, why:'Le gain a changé depuis la mesure enregistrée. Vérifie à nouveau le passage fort avant de réutiliser ses seuils.', action:'Reprendre cette mesure', channel:stale.channel, tone:'warn' };
    const pending = input.meters.find(m=>!input.calibration!.some(c=>c.channel===m.channel && c.state==='ok'));
    if (pending) return { step:'levels', title:`Mesurer ${pending.name}`, why:'Cet instrument n’a pas encore de mesure valide. Termine les niveaux avant de considérer la balance comme prête à sauvegarder.', action:'Mesurer cet instrument', channel:pending.channel, tone:'neutral' };
  }
  if (!input.completed.includes('levels')) return { step:'levels', title:'Mesurer un instrument à la fois', why:input.simulation ? 'Découvre le parcours en simulation. La mesure du gain demandera la vraie console et le musicien.' : 'Fais jouer le passage le plus fort. Cette mesure sert ensuite à préparer le gain et les seuils des traitements.', action:'Régler les niveaux', tone:'neutral' };
  if (!input.completed.includes('tone')) return { step:'tone', title:'Écouter le groupe ensemble', why:'Choisis un canal, décris un seul problème et compare une petite correction au réglage précédent.', action:'Travailler le son', tone:'neutral' };
  if (!input.completed.includes('ears')) return { step:'ears', title:'Vérifier chaque retour', why:'Chaque musicien doit distinguer ce dont il a besoin pour jouer, à un volume d’écoute confortable.', action:'Préparer les retours', tone:'neutral' };
  return { step:'save', title:'Conserver cette balance', why:'Quand l’écoute te convient, enregistre une scène. Les étapes cochées indiquent tes vérifications, pas une validation automatique du son.', action:'Sauvegarder ma balance', tone:'neutral' };
}
export function coachMeters(inputs: {channel:number;name:string}[], levels: number[], fresh: boolean): CoachMeter[] {
  return inputs.map(i => { const value = levels[i.channel - 1]; return {...i, db: fresh && typeof value === 'number' && Number.isFinite(value) ? value : null}; });
}
