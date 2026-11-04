import { pad, type Values } from "./controls";

export type Kind = "ch" | "aux" | "fxrtn" | "bus" | "fxsend" | "lr" | "dca";
export interface Strip { id: string; kind: Kind; prefix: string; short: string; fallback: string; meters: number[] }

/** /meters/1 order: ch1-16, aux L/R, fx returns L/R, bus 1-6, fx sends 1-4, main L/R, monitor L/R. */
export const INPUTS: Strip[] = [
  ...Array.from({ length: 16 }, (_, i): Strip => ({ id: `ch${i + 1}`, kind: "ch", prefix: `/ch/${pad(i + 1)}`, short: pad(i + 1), fallback: `Ch ${pad(i + 1)}`, meters: [i] })),
  { id: "aux", kind: "aux", prefix: "/rtn/aux", short: "Aux", fallback: "Aux", meters: [16, 17] },
  ...Array.from({ length: 4 }, (_, i): Strip => ({ id: `rtn${i + 1}`, kind: "fxrtn", prefix: `/rtn/${i + 1}`, short: `FX ${i + 1}`, fallback: `FX ${i + 1}`, meters: [18 + i * 2, 19 + i * 2] })),
];
export const BUSES: Strip[] = Array.from({ length: 6 }, (_, i): Strip => ({ id: `bus${i + 1}`, kind: "bus", prefix: `/bus/${i + 1}`, short: `Bus ${i + 1}`, fallback: `Bus ${i + 1}`, meters: [26 + i] }));
export const FXSENDS: Strip[] = Array.from({ length: 4 }, (_, i): Strip => ({ id: `fxs${i + 1}`, kind: "fxsend", prefix: `/fxsend/${i + 1}`, short: `Send ${i + 1}`, fallback: `FX ${i + 1}`, meters: [32 + i] }));
export const DCAS: Strip[] = Array.from({ length: 4 }, (_, i): Strip => ({ id: `dca${i + 1}`, kind: "dca", prefix: `/dca/${i + 1}`, short: `DCA ${i + 1}`, fallback: `DCA ${i + 1}`, meters: [] }));
export const OUTPUTS: Strip[] = [...BUSES, ...FXSENDS, ...DCAS];
export const MAIN: Strip = { id: "lr", kind: "lr", prefix: "/lr", short: "LR", fallback: "LR", meters: [36, 37] };
export const ALL: Strip[] = [...INPUTS, ...OUTPUTS, MAIN];

/** Mix layers ("sends on fader"): 0 = Main LR, 1-6 = bus, 7-10 = FX send. */
export const layerMaster = (layer: number) => layer === 0 ? MAIN : layer <= 6 ? BUSES[layer - 1]! : FXSENDS[layer - 7]!;
export const isInput = (s: Strip) => s.kind === "ch" || s.kind === "aux" || s.kind === "fxrtn";

export function stripName(strip: Strip, values: Values) {
  const n = values[`${strip.prefix}/config/name`];
  return typeof n === "string" && n.trim() ? n : strip.fallback;
}
export function faderAddress(strip: Strip, layer: number) {
  if (strip.kind === "dca") return `${strip.prefix}/fader`;
  return isInput(strip) && layer > 0 ? `${strip.prefix}/mix/${pad(layer)}/level` : `${strip.prefix}/mix/fader`;
}
export const onAddress = (strip: Strip) => strip.kind === "dca" ? `${strip.prefix}/on` : `${strip.prefix}/mix/on`;
export const soloAddress = (strip: Strip) => strip.kind === "ch" ? `/-stat/solosw/${strip.short}` : null;

/** Gain control that really feeds this channel (analog preamp, or trim for USB / returns). */
export function gainControl(strip: Strip, values: Values, micPreamps=16) {
  if (strip.kind === "aux" || strip.kind === "fxrtn") return { address: `${strip.prefix}/preamp/rtntrim`, lo: -18, hi: 18, label: "Trim", headamp: null as string | null };
  if (strip.kind !== "ch") return null;
  const usb = values[`${strip.prefix}/preamp/rtnsw`] === 1;
  const source = typeof values[`${strip.prefix}/config/insrc`] === "number" ? values[`${strip.prefix}/config/insrc`] as number : strip.meters[0]!;
  if (usb) return { address: `${strip.prefix}/preamp/rtntrim`, lo: -18, hi: 18, label: "Trim USB", headamp: null };
  if (source >= 0 && source < micPreamps) return { address: `/headamp/${pad(source + 1)}/gain`, lo: -12, hi: 60, label: `Gain IN ${source + 1}`, headamp: `/headamp/${pad(source + 1)}` };
  return null;
}
