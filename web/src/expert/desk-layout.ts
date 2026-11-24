import {useEffect, useState} from 'react';
import {cleanBanks, type FaderBank} from './fader-banks';

export const stripModules=['input','eq','comp'] as const;
export const mixLayers=Array.from({length:10},(_,i)=>i+1);
export type Module=typeof stripModules[number];
export type Layout = {hiddenModules?:Module[];hiddenMixes?:number[];hidden:string[]; outputs:boolean; density:'compact'|'comfortable'; banks:FaderBank[]; activeBank:string};
export const displayDefaults = {hiddenModules:[] as Module[], hiddenMixes:[] as number[], hidden:[] as string[], outputs:true, density:'compact' as const};
const storageKey = 'bandpilot-workspaces-v1';
type Layouts = Record<string, Layout>;
type Bridge = {get:()=>Layouts|null; set:(value:Layouts)=>boolean};
const desktop = () => (window as Window & {bandpilotWorkspaces?:Bridge}).bandpilotWorkspaces;
export const screenClass = (width:number) => width < 760 ? 'small' : width < 1400 ? 'medium' : 'wide';
function readLayouts():Layouts {
  try {
    const native = desktop()?.get();
    if (native) return native;
    const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
    // Migrate existing browser layouts when first opening the desktop bridge.
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (Object.keys(raw).length) desktop()?.set(raw);
      return raw;
    }
  } catch { /* A missing preference must not prevent opening the mixer. */ }
  return {};
}
export function useDeskLayout(model:string) {
  const [screen, setScreen] = useState(() => screenClass(window.innerWidth));
  const [layouts, setLayouts] = useState(readLayouts);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => { const resize = () => setScreen(screenClass(window.innerWidth)); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const key = `${model}:${screen}`, saved = layouts[key];
  const layout:Layout = {hiddenModules:stripModules.filter(k=>Array.isArray(saved?.hiddenModules)&&saved.hiddenModules.includes(k)),
    hiddenMixes:mixLayers.filter(k=>Array.isArray(saved?.hiddenMixes)&&saved.hiddenMixes.includes(k)),hidden:Array.isArray(saved?.hidden) ? saved.hidden.filter(x => typeof x === 'string') : [], outputs:saved?.outputs !== false, density:saved?.density === 'comfortable' ? 'comfortable' : 'compact', banks:cleanBanks(saved?.banks), activeBank:typeof saved?.activeBank === 'string' ? saved.activeBank : 'inputs'};
  const update = (patch:Partial<Layout>) => {
    const next = {...layouts, [key]:{...layout, ...patch}};
    let stored = false;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); stored = true; } catch { /* Native storage may still work. */ }
    try { const bridge = desktop(); if (bridge) stored = bridge.set(next); } catch { stored = false; }
    setStorageError(!stored); setLayouts(next);
    return stored;
  };
  return {model, layout, update, screen, storageError, reset:() => update(displayDefaults)};
}
export type DeskLayout = ReturnType<typeof useDeskLayout>;
