export const isAndroid=typeof window!=='undefined'&&!!(window as unknown as {BandPilotAndroid?:unknown}).BandPilotAndroid;
export const isIOS=typeof window!=='undefined'&&!!(window as unknown as {BandPilotIOS?:unknown}).BandPilotIOS;
export const isNativeMobile=isAndroid||isIOS;
