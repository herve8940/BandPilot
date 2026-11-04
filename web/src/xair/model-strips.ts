import {useMixerModel} from '../MixerModel';
import {ALL as LEGACY_ALL,INPUTS as LEGACY_INPUTS,BUSES,FXSENDS,OUTPUTS,MAIN} from './strips';
export function useAirStrips(){
 const model=useMixerModel();
 const INPUTS=LEGACY_INPUTS.filter(s=>s.kind!=='ch'||Number(s.short)<=model.channels);
 const ALL=LEGACY_ALL.filter(s=>s.kind!=='ch'||Number(s.short)<=model.channels);
 return {INPUTS,ALL,BUSES,FXSENDS,OUTPUTS,MAIN,model};
}
