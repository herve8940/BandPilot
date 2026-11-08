import {timingSafeEqual} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
/** A private per-launch capability protects the mobile loopback engine from other apps. */
export const isNativeMobile=process.env.BANDPILOT_ANDROID==='1'||process.env.BANDPILOT_IOS==='1';
export function nativeAccess(req:IncomingMessage,token=process.env.BANDPILOT_NATIVE_TOKEN){
 if(!token)return true;
 const header=req.headers['x-bandpilot-native-token'];
 const candidate=typeof header==='string'?header:/(?:^|;\s*)bandpilot_native=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1]??'';
 const a=Buffer.from(token),b=Buffer.from(candidate);
 return a.length===b.length&&timingSafeEqual(a,b);
}
