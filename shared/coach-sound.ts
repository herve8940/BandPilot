/** Independent preferences: processing style, input headroom, and each musician's monitoring. */
export const COACH_SOUNDS = [
 {id:'live-rock',label:'Rock live',description:'Presets rock avec égalisation et dynamique par instrument.'},
 {id:'natural',label:'Naturel',description:'EQ neutre hors coupe-bas, compression légère et gates désactivés au départ.'},
] as const;
export type CoachSound = typeof COACH_SOUNDS[number]['id'];
export const DEFAULT_COACH_SOUND:CoachSound='live-rock';
export const isCoachSound=(value:unknown):value is CoachSound=>COACH_SOUNDS.some(s=>s.id===value);
export const coachSound=(sound?:CoachSound)=>COACH_SOUNDS.find(s=>s.id===sound)??COACH_SOUNDS[0];

export const GAIN_HEADROOMS = [
 {id:'standard',label:'Standard · crêtes vers −6 dBFS',targetPeakDb:-6},
 {id:'extra',label:'Plus de marge · crêtes vers −9 dBFS',targetPeakDb:-9},
] as const;
export type GainHeadroom = typeof GAIN_HEADROOMS[number]['id'];
export const DEFAULT_GAIN_HEADROOM:GainHeadroom='standard';
export const isGainHeadroom=(value:unknown):value is GainHeadroom=>GAIN_HEADROOMS.some(h=>h.id===value);
export const gainHeadroom=(headroom?:GainHeadroom)=>GAIN_HEADROOMS.find(h=>h.id===headroom)??GAIN_HEADROOMS[0];

export const MONITOR_LISTENING = [
 {id:'in-ear',label:'In-ears'},
 {id:'headphones',label:'Casque'},
 {id:'wedge',label:'Retour de scène'},
] as const;
export type MonitorListening = typeof MONITOR_LISTENING[number]['id'];
export const isMonitorListening=(value:unknown):value is MonitorListening=>MONITOR_LISTENING.some(m=>m.id===value);
