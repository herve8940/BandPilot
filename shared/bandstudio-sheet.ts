export type SheetCue={start:number;end:number;text:string};
export type SongSheet={chords:SheetCue[];lyrics:SheetCue[];key?:string;capo?:number};
export type SheetFrame={
 project:string;title:string;position:number;section?:string;loop:boolean;playing:boolean;
 cue?:{name:string;repeatSection:boolean;twoAt:number;oneAt:number;at:number};
 rate:number;loopStart?:number;loopEnd?:number;sampledAt:number;sentAt?:number;serverMs?:number;
 revision:string;sheet?:SongSheet;canPreview?:boolean;sourceApproved?:boolean;preview?:boolean;
};

/** Predict only a short distance from the last audio-clock sample, including REAPER's loop wrap. */
export function sheetPosition(frame:SheetFrame,elapsedMs:number){
 if(!frame.playing)return frame.position;
 const ahead=Math.max(0,Math.min(650,elapsedMs))*frame.rate/1000;
 const pos=frame.position+ahead,left=frame.loopStart,right=frame.loopEnd;
 return frame.loop&&left!==undefined&&right!==undefined&&right>left&&pos>=right?left+(pos-right)%(right-left):pos;
}
