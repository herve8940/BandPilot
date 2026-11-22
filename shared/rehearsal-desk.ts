export const REHEARSAL_BRIDGE='rehearsal-tabs/9';
export const PROJECT_ID=/^[0-9a-fA-F]{32}-[1-9]\d{0,8}$/;
export const MARK_ID=/^[mre]\d{1,9}$/;
export const TRACK_ID=/^\{[\da-fA-F-]{36}\}$/;
export const TAKE_ID=/^[\da-fA-F-]{32,36}$/;
export type RehearsalSource='original'|'backing'|'take';
export type RehearsalAction='play'|'pause'|'stop'|'record'|'marker'|'save'|'setup'|'arm'|'input'|'configuredInput'|'seek'|'track'|'select'|'section'|'leaveLoop'|'guideVolume';
export type RehearsalCommand={
 project:string;action:RehearsalAction;source?:RehearsalSource;take?:string;loop?:boolean;leadIn?:boolean;countBars?:number;
 a?:string;b?:string;name?:string;original?:string;endMarker?:string;autoSave?:boolean;
 track?:string;volume?:number;on?:boolean;index?:number;stereo?:boolean;position?:number;kind?:'mute'|'solo';
};
export type RehearsalTab={id:string;title:string;number:number;saved:boolean;current:boolean;duration?:number};
export type RehearsalTake={id:string;number:number;stamp:number;first:number;last:number;partial:boolean;channels:number};
export type RehearsalMarker={id:string;pos:number;name:string;ending?:boolean};
export type ConfiguredInput={usb:number;name:string;stereo:boolean;available:boolean};
export type RehearsalProject={
 id:string;original?:string;choices:{id:string;name:string}[];marks:RehearsalMarker[];
 start:number;ending?:number;endMarker:string;autoSave:boolean;takes:RehearsalTake[];
 inputs:number;recordTracks:{id:string;name:string;armed:boolean;channels:number[];available:boolean}[];
 guides?:{id:string;name:string;volume:number;mute:boolean}[];
 backing?:{id:string;name:string;mute:boolean}[];
 picture?:{tracks:RehearsalTrack[];regions:{start:number;stop:number;name:string}[]};
 armed:number;recordProblem?:string;pos:number;during?:'play'|'record';stopAt?:number;loopStart?:number;leavingAt?:number;countInTo?:number;playTake?:string;source?:RehearsalSource;dirty:boolean;
};
export type RehearsalStatus={
 revision?:string;position?:number;rate?:number;
 bridge:'ready'|'offline'|'update';tabs:RehearsalTab[];active?:string;transport:'idle'|'starting'|'playing'|'paused'|'recording';
 owned?:boolean;project?:RehearsalProject;notice?:{kind:'take'|'empty'|'marker'|'saved'|'startError';project:string;number?:number;partial?:boolean};
};
export type RehearsalTrack={
 id:string;index:number;name:string;rec:boolean;role:string|null;mute:boolean;solo:boolean;armed:boolean;
 items:{pos:number;length:number;takes:{index:number;name:string;file:string;active:boolean}[]}[];
};
