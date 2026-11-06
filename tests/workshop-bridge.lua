-- Executes the production workshop handlers with a REAPER project/PCM double.
local source={path='/source.rpp',tracks={{name='Basse',guid='bass',items={{pos=5,len=10,take={file='/raw.wav',channels=1,offset=2,rate=1,pitch=0}}}}},ext={}}
local current=source;local projects={source};local playing=0;local closed=0;local created=0;local audioOpen=false
local mediaOnline=false
local H={transport=function()return {playing=playing==1}end}
local r={
 EnumProjects=function(i) local p=i==-1 and current or projects[i+1];return p,p and p.path or '' end,
 GetPlayState=function()return playing end,GetProjExtState=function(p,_,k)return 1,p.ext[k] or '' end,
 SetProjExtState=function(p,_,k,v)p.ext[k]=v end,
 GetTrack=function(p,i)if p==0 then p=current end;return p.tracks[i+1]end,CountTracks=function(p)if p==0 then p=current end;return #p.tracks end,
 GetTrackGUID=function(t)return t.guid end,CountTrackMediaItems=function(t)return #t.items end,GetTrackMediaItem=function(t,i)return t.items[i+1]end,
 GetActiveTake=function(it)return it.take end,TakeIsMIDI=function()return false end,
 GetMediaItemTake_Source=function(t)return t end,GetMediaSourceFileName=function(t)return t.file end,file_exists=function()return true end,
 GetMediaSourceNumChannels=function(t)return mediaOnline and t.channels or 1 end,GetTakeName=function()return 'take 1'end,
 GetMediaSourceLength=function()return 30,false end,
 GetMediaSourceParent=function(t)return t.section end,
 GetMediaItemInfo_Value=function(it,k)return ({D_POSITION=it.pos,D_LENGTH=it.len,B_LOOPSRC=1})[k] or 0 end,
 GetMediaItemTakeInfo_Value=function(t,k)return ({D_STARTOFFS=t.offset,D_PLAYRATE=t.rate,D_PITCH=t.pitch,I_CHANMODE=0})[k] end,
 TakeFX_GetCount=function()return 0 end,GetTakeNumStretchMarkers=function()return 0 end,
 Audio_Init=function()audioOpen=true end,GetNumAudioOutputs=function()return 18 end,GetAudioDeviceInfo=function(k)return true,k=='SRATE' and '48000' or 'XR18'end,
 Main_OnCommand=function(id)if id==40101 then mediaOnline=true;return end;assert(id==40859);current={path='',tracks={},ext={}};projects[#projects+1]=current;created=created+1 end,
 OnStopButton=function()playing=0 end,OnPlayButton=function()playing=1 end,
 DeleteTrack=function()table.remove(current.tracks,1)end,GetSetProjectInfo=function()end,
 InsertTrackAtIndex=function(i)table.insert(current.tracks,i+1,{items={},sends={},values={}})end,
 GetSetMediaTrackInfo_String=function(t,k,v)t.name=v end,SetMediaTrackInfo_Value=function(t,k,v)t.values[k]=v end,
 CreateTrackSend=function(t)t.sends[1]={};return 0 end,SetTrackSendInfo_Value=function(t,_,_,k,v)t.sends[1][k]=v end,
 AddMediaItemToTrack=function(t)local i={};t.items[#t.items+1]=i;return i end,
 AddTakeToMediaItem=function(it)it.take={};return it.take end,PCM_Source_CreateFromFile=function(f)return {file=f}end,
 SetMediaItemTake_Source=function(t,s)t.file=s.file end,SetMediaItemInfo_Value=function(it,k,v)it[k]=v end,
 SetMediaItemTakeInfo_Value=function(t,k,v)t[k]=v end,GetSetMediaItemTakeInfo_String=function()end,
 GetSet_LoopTimeRange=function()end,GetSetRepeat=function()end,SetEditCurPos=function()end,
 Main_SaveProjectEx=function(p,f,options)assert(options==8);p.path=f end,UpdateArrange=function()end,
 SelectProjectInstance=function(p)current=p end,GetProjectStateChangeCount=function()return 12 end,
 CreateTrackAudioAccessor=function()return {}end,DestroyAudioAccessor=function()closed=closed+1 end,
 new_array=function(n)local b={};for i=1,n do b[i]=0 end;b.table=function()local t={};for i=1,n do t[i]=b[i] end;return t end;b.fft_real=function()for i=1,n do b[i]=0 end end;return b end,
 GetAudioAccessorSamples=function(_,_,_,_,n,b)if not mediaOnline then return 0 end;for i=1,n*2 do b[i]=.5 end;return 1 end
}
local each=function(fn)for i,t in ipairs(current.tracks)do fn(t,i-1)end end
dofile('integrations/BandPilot_Workshop.lua')(H,r,{each_track=each,track_name=function(t)return t.name end})
local c=H.workshop_catalog({});assert(c.tracks[1].name=='Basse' and c.tracks[1].items[1].offset==2)
assert(audioOpen and playing==0,'background audio device reopened without playback even when the output count is cached')
source.tracks[1].items[1].take.channels=2;mediaOnline=false
assert(H.workshop_catalog({}).tracks[1].channels==2,'offline stereo sources must not be mapped as mono')
source.tracks[1].items[1].take.channels=1
local args={id='abcd',source='/source.rpp',file='/atelier.rpp',start=7,stop=12,rate=48000,mapping={{index=0,guid='bass',channel=2,channels=1}}}
playing=4;assert(not pcall(H.workshop_create,args));assert(created==0);playing=0
args.mapping[1].guid='wrong';assert(not pcall(H.workshop_create,args));assert(created==0);args.mapping[1].guid='bass'
source.tracks[1].items[1].take.section={};assert(not pcall(H.workshop_create,args));assert(created==0);source.tracks[1].items[1].take.section=nil
local result=H.workshop_create(args);assert(result.project=='/atelier.rpp' and created==1 and #source.tracks==1)
local t=current.tracks[1];assert(t.values.B_MAINSEND==0 and t.values.I_RECARM==0 and t.values.B_MUTE==1)
assert(t.sends[1].I_DSTCHAN==1025 and t.sends[1].I_SRCCHAN==1024 and t.sends[1].D_VOL==1)
assert(t.items[1].D_POSITION==7 and t.items[1].D_LENGTH==5 and t.items[1].take.D_STARTOFFS==4)
local request={id='abcd',project='/atelier.rpp',revision=12,track=0,start=7,duration=.01}
mediaOnline=false
local m=H.workshop_measure(request);assert(m.peak==.5 and m.samples==960 and m.sumSquares==240 and closed==1,'background media brought online before measurement')
request.revision=13;assert(not pcall(H.workshop_measure,request));request.revision=12
assert(#m.spectrum==28 and m.stereo.left==0,'DC rejected from stereo correlation')
local mono={};for k,v in pairs(request)do mono[k]=v end;mono.channels=1
local oldSamples=r.GetAudioAccessorSamples;r.GetAudioAccessorSamples=function(_,_,channels,_,n,b)for i=1,n*channels do b[i]=.5 end;return 1 end
local mm=H.workshop_measure(mono);assert(mm.samples==480 and mm.sumSquares==120 and mm.stereo==nil,'mono not duplicated')
assert(mm.envelope.step==.02 and #mm.envelope.peak==1 and math.abs(mm.envelope.peak[1]+6.0206)<.001 and math.abs(mm.envelope.rms[1]+6.0206)<.001,'short mono envelope correctly normalized')
r.GetAudioAccessorSamples=oldSamples
r.GetAudioAccessorSamples=function()return 0 end;local silence=H.workshop_measure(request);assert(silence.samples==960 and silence.sumSquares==0,'silent gaps count toward the passage RMS')
assert(silence.envelope.peak[1]==-120 and silence.envelope.rms[1]==-120,'missing audio is explicit silence, never a fake transient')
r.GetAudioAccessorSamples=function()return -1 end;assert(not pcall(H.workshop_measure,request));assert(closed==4,'accessor cleaned up after errors')
H.workshop_transport({id='abcd',project='/atelier.rpp',action='play',start=7});assert(playing==1 and t.values.B_MUTE==0)
assert(not pcall(H.workshop_measure,request))
H.workshop_leave({id='abcd',project='/atelier.rpp',source='/source.rpp'});assert(playing==0 and current==source and t.values.B_MUTE==1)
assert(source.tracks[1].items[1].pos==5 and source.tracks[1].items[1].take.offset==2,'source project unchanged')
print('Workshop bridge passed')
