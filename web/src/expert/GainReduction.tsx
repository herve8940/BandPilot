import {useEffect,useState} from "react";
import type {Strip} from "../xair/strips";

export function GainReduction({ strip }: { strip: Strip }) {
  const [db, setDb] = useState<number | null>(null);
  useEffect(() => {
    let active = true, unsupported = false;
    setDb(null);
    const poll = async () => {
      if (unsupported) return;
      try {
        const response = await fetch("/api/dynamics");
        if (!response.ok) { if (response.status === 404) unsupported = true; if (active) setDb(null); return; }
        const { frame } = await response.json();
        const value = !frame ? null : strip.kind === "ch" ? frame.comp[Number(strip.short) - 1] : strip.kind === "bus" ? frame.bus[Number(strip.short.replace("Bus ", "")) - 1] : frame.lr;
        if (active) setDb(typeof value === "number" && Number.isFinite(value) ? Math.min(0, value) : null);
      } catch { if (active) setDb(null); }
    };
    void poll(); const timer = setInterval(() => void poll(), 500);
    return () => { active = false; clearInterval(timer); };
  }, [strip.id]);
  return <div className="visual-gain-reduction" aria-label="Réduction de gain du compresseur"><span>Réduction de gain</span><div role="meter" aria-label="Réduction de gain" aria-valuemin={0} aria-valuemax={30} aria-valuenow={db === null ? undefined : Math.min(30, -db)} aria-valuetext={db === null ? "Mesure indisponible" : `${db.toFixed(1)} dB`}><i style={{ width: `${db === null ? 0 : Math.min(100, -db / 30 * 100)}%` }}/></div><output>{db === null ? "—" : `${db.toFixed(1)} dB`}</output></div>;
}
