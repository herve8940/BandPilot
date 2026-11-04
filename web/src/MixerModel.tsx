import {createContext,useContext} from 'react';
import {DEFAULT_MIXER,type MixerProfile} from '../../shared/mixer-models';
export const MixerModelContext=createContext<MixerProfile>(DEFAULT_MIXER);
export const useMixerModel=()=>useContext(MixerModelContext);
