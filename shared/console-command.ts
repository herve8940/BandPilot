export const COMMAND_TARGETS={fader:'Faders de façade',send:'Niveaux vers un retour',eq:'Gain d’une bande EQ',compressor:'Seuil du compresseur',gate:'Seuil du gate',mute:'Mute'} as const;
export type CommandStep={channel:number;target:keyof typeof COMMAND_TARGETS;value:number;bus?:number;band?:number;delayMs?:number};
export type CommandCondition=Omit<CommandStep,'value'|'delayMs'>&{comparison:'above'|'below';threshold:number;hysteresis:number};
export type ConditionSet={match:'all'|'any';rules:CommandCondition[];offSteps?:CommandStep[]};
export type ConsoleCommand={version:1;model:string;steps:CommandStep[];delayMs?:number;condition?:CommandCondition;conditionSet?:ConditionSet};
export type CommandControlMode='midi'|'automatic'|'once';

export const commandRules=(command:ConsoleCommand)=>command.conditionSet?.rules??(command.condition?[command.condition]:[]);
export const commandIsTimed=(command:ConsoleCommand)=>!!(command.delayMs||command.steps.some(step=>step.delayMs));
