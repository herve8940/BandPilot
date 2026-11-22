-- REAPER model with deterministic project clocks, independent tracks and media files.
local r, H = {}, {}
local projects, now, focused, sequence = {}, 0, nil, 0
local function uid() sequence=sequence+1;return string.format("{%08x-0000-0000-0000-000000000000}",sequence) end
local function track(name,io,items)
  return {name=name,guid=uid(),ext="",items=items or {},values={I_RECARM=io and 1 or 0,I_RECMODE=0,I_RECINPUT=io and io-1 or -1,I_NCHAN=2,I_RECMON=io and 1 or 0,B_MUTE=0,I_SOLO=0,B_MAINSEND=1}}
end
local function project(title)
  local p={title=title,path="/fixture/"..title..".rpp",state=0,cursor=0,pos=0,repeatMode=1,loopA=50,loopB=60,selA=80,selB=85,recordMode=40076,ext={},saved=0,dirty=false,
    marks={{1,0,"Début"},{2,30,"Refrain"},{3,60,"Pont"},{4,90,"Fin"}},tracks={track("Original",nil,{{start=0,length=88}}),track("Accompagnement",nil,{{start=0,length=88}}),track("Chant",1),track("Basse",2)}}
  projects[#projects+1]=p
  return p
end
local one, two, three=project("Identical"),project("Identical"),project("Other")
focused=one
r.genGuid=uid
r.time_precise=function() return now end
r.CountTracks=function(p) return #p.tracks end
r.GetTrack=function(p,i) return p.tracks[i+1] end
r.EnumProjects=function(i) local p=i==-1 and focused or projects[i+1];return p,p and p.path end
r.GetProjectName=function(p,buf)
 assert(type(buf)=="string", "bad argument #2 to 'GetProjectName' (string expected, got "..type(buf)..")")
 return p.title..".rpp"
end
r.Master_GetPlayRate=function() return 1 end
r.GetProjectStateChangeCount=function(p) return #p.tracks+#p.marks end
-- 3/4 at 120 BPM, then 4/4 at 60 BPM from QN 6.
r.TimeMap2_timeToQN=function(_,t) return t<3 and t*2 or 6+t-3 end
r.TimeMap2_QNToTime=function(_,q) return q<6 and q/2 or 3+q-6 end
r.TimeMap_QNToMeasures=function(_,q)
 local width=q<6 and 3 or 4
 local base=q<6 and 0 or 6
 local bar=math.floor((q-base)/width)
 return bar,base+bar*width,base+(bar+1)*width
end
r.GetProjectLength=function() return 90 end
r.GetPlayStateEx=function(p) return p.state end
r.GetPlayPositionEx=function(p) return p.pos end
r.GetCursorPositionEx=function(p) return p.cursor end
r.GetTrackGUID=function(tr) return tr.guid end
r.GetSetMediaTrackInfo_String=function(tr,key,v,set)
 local k=key=="P_NAME" and "name" or key
 if set then tr[k]=v end
 return true,tr[k] or ""
end
r.GetMediaTrackInfo_Value=function(tr,k) return tr.values[k] or 0 end
r.SetMediaTrackInfo_Value=function(tr,k,v) tr.values[k]=v;return true end
r.GetParentTrack=function() return nil end
r.CountTrackMediaItems=function(tr) return #tr.items end
r.GetTrackMediaItem=function(tr,i) return tr.items[i+1] end
r.GetMediaItemInfo_Value=function(it,k) return k=="D_POSITION" and it.start or it.length end
r.CountProjectMarkers=function(p) return #p.marks end
r.EnumProjectMarkers3=function(p,i) local m=p.marks[i+1];return 1,false,m[2],0,m[3],m[1] end
r.AddProjectMarker2=function(p,_,at,_,name) local id=#p.marks+1;p.marks[id]={id,at,name};p.dirty=true;return id end
r.GetProjExtState=function(p,_,key) return p.ext[key] and 1 or 0,p.ext[key] or "" end
r.SetProjExtState=function(p,_,key,v) p.ext[key]=v;return 1 end
r.ValidatePtr2=function(p,tr) for _,candidate in ipairs(p.tracks) do if tr==candidate then return true end end;return false end
r.GetSetRepeatEx=function(p,mode) if mode~=-1 then p.repeatMode=mode end;return p.repeatMode end
r.GetSet_LoopTimeRange2=function(p,set,loop,a,b)
 local aa,bb=loop and "loopA" or "selA",loop and "loopB" or "selB"
 if set then p[aa]=a;p[bb]=b end;return p[aa],p[bb]
end
r.GetToggleCommandStateEx=function(_,id) return focused.recordMode==id and 1 or 0 end
r.SelectProjectInstance=function(p) focused=p end
r.SetEditCurPos2=function(p,a) p.cursor=a;p.pos=a end
r.GetNumAudioInputs=function() return 18 end
r.OnPlayButtonEx=function(p) p.state=1 end
r.OnPauseButtonEx=function(p) p.state=2 end
r.OnStopButtonEx=function(p) p.state=0 end
r.InsertTrackAtIndex=function(i) table.insert(focused.tracks,i+1,track("",nil)) end
r.DeleteTrack=function(tr) for _,p in ipairs(projects) do for i,candidate in ipairs(p.tracks) do if tr==candidate then table.remove(p.tracks,i);return end end end end
r.MarkProjectDirty=function(p) p.dirty=true end
r.IsProjectDirty=function(p) return p.dirty and 1 or 0 end
r.Main_SaveProject=function(p) p.saved=p.saved+1;p.dirty=false end
r.UpdateArrange=function() end
r.Main_OnCommandEx=function(id,_,p)
  if id==1013 then
    if not p.delayedStart then p.state=5 end
    p.recStart=p.pos
  elseif id==40667 then
    p.state=0
    for _,tr in ipairs(p.tracks) do
      if tr.values.I_RECARM==1 and tr.values.I_RECMODE==0 and p.pos>p.recStart then
        tr.items[#tr.items+1]={start=p.recStart,length=p.pos-p.recStart,file=tostring(tr.guid)..".wav"}
      end
    end
  elseif id==40252 or id==40076 then p.recordMode=id
  else error("Unexpected command") end
end

local helpers={items=function(tr) return tr.items end,peaks=function(tr) return {name=tr.name} end}
local scheduler=dofile("integrations/BandPilot_Rehearsal.lua")(H,r,helpers)
local function command(id,action,options)
 options=options or {};options.project=id;options.action=action
 return H.rehearsal_command(options)
end
local list=H.rehearsal_state({}).tabs
assert(#list==3 and list[1].id~=list[2].id)
assert(list[1].title=="Identical" and list[2].title=="Identical" and list[3].title=="Other")
local a,b,c=list[1].id,list[2].id,list[3].id
command(b,"select")
assert(focused==two)
local initial=H.rehearsal_state({detail=true})
two.cursor=4
local pulse=H.rehearsal_state({detail=true,known=initial.revision})
assert(pulse.project==nil and pulse.position==4 and pulse.rate==1)
assert(H.rehearsal_state({project=a,detail=true,known=initial.revision}).project.id==a)
local second=H.rehearsal_state({project=b,detail=true})
assert(second.project.picture.tracks[1].id==two.tracks[1].guid and second.project.picture.tracks[1].id~=one.tracks[1].guid)
assert(H.rehearsal_peaks({project=b,track=two.tracks[1].guid}).name=="Original")
assert(not pcall(H.rehearsal_peaks,{project=b,track=one.tracks[1].guid}))
assert(H.rehearsal_state({project=b}).project.picture==nil)
local view=command(b,"play",{source="original",a="m2",b="m3"})
assert(view.active==b and view.project.pos==30 and view.project.stopAt==60)
assert(one.state==0 and two.tracks[1].values.I_SOLO==2 and two.repeatMode==0)
assert(not pcall(command,a,"play",{source="original"}))
two.pos=59.9;scheduler.tick();assert(two.state==1)
two.pos=60.04;scheduler.tick();assert(two.state==0)
scheduler.tick();assert(two.tracks[1].values.I_SOLO==0 and two.repeatMode==1)
view=command(b,"play",{source="original",a="m2",b="m3",loop=true})
assert(two.loopA==30 and two.loopB==60 and two.repeatMode==1)
two.pos=60.01;scheduler.tick();assert(two.state==1)
view=command(b,"section",{a="m1",b="m2"})
assert(view.project.loopStart==0 and two.loopB==30 and two.pos==0 and two.repeatMode==1)
assert(not pcall(command,a,"section",{a="m1",b="m2"}))
command(b,"stop");assert(two.loopA==50 and two.loopB==60)

command(b,"setup",{autoSave=true})
view=command(b,"record")
assert(view.project.stopAt==90 and two.state==5 and #two.tracks==6 and two.recordMode==40252 and two.selA==0)
assert(two.tracks[5].values.I_RECMODE==2 and two.tracks[5].values.I_RECMON==1)
assert(two.tracks[1].values.B_MAINSEND==0 and two.tracks[3].values.B_MUTE==1)
two.pos=20.3;command(b,"marker",{name="À revoir"})
assert(two.marks[#two.marks][2]==20.3)
two.pos=90.02;scheduler.tick()
assert(two.state==0 and one.state==0)
scheduler.tick()
view=H.rehearsal_state({project=b})
assert(two.recordMode==40076 and two.selA==80 and two.selB==85)
assert(two.saved==1 and #view.project.takes==1 and view.project.takes[1].channels==2 and not view.project.takes[1].partial)
local firstId=view.project.takes[1].id
local firstFile=two.tracks[1].items[1].file
assert(two.tracks[1].values.I_RECARM==0 and two.tracks[1].values.B_MUTE==1)
assert(two.tracks[5].values.I_RECMODE==0 and two.tracks[6].values.I_RECMODE==0)

two.tracks[6].values.I_RECARM=0
command(b,"record",{a="m2",b="m3"})
two.pos=45;command(b,"stop")
view=H.rehearsal_state({project=b})
assert(#view.project.takes==2 and view.project.takes[1].channels==1 and view.project.takes[1].partial)
assert(view.project.takes[1].first==30 and view.project.takes[1].last==45 and view.project.takes[2].id==firstId)
assert(firstFile==two.tracks[2].items[1].file and firstFile~=two.tracks[1].items[1].file)
command(b,"play",{source="take",take=view.project.takes[1].id})
assert(two.tracks[1].values.I_SOLO==2 and two.tracks[2].values.I_SOLO==0 and two.tracks[3].values.I_SOLO==0)
command(b,"stop")
assert(two.tracks[1].values.B_MUTE==1 and two.tracks[2].values.B_MUTE==1)

-- The audio device can take time to start; keep the capture tracks until REAPER confirms it.
two.delayedStart=true
view=command(b,"record",{a="m2",b="m3"})
assert(view.transport=="starting" and #two.tracks==8 and two.state==0)
now=1;scheduler.tick()
assert(#two.tracks==8)
two.state=5;now=2;scheduler.tick();two.pos=60.01;scheduler.tick();scheduler.tick()
assert(#H.rehearsal_state({project=b}).project.takes==3)
command(b,"record")
now=8;scheduler.tick()
assert(H.rehearsal_state({project=b}).notice.kind=="startError" and #two.tracks==8)

-- One lead-in across the time-signature and tempo boundary. Subsequent passes loop only 3..30.
three.marks[#three.marks+1]={9,3,"Chorus"}
view=command(c,"play",{source="backing",a="m9",b="m2",loop=true,leadIn=true})
assert(three.pos==1.5 and three.loopA==3 and three.loopB==30)
three.pos=24
assert(not pcall(command,b,"leaveLoop"))
view=command(c,"leaveLoop")
assert(view.project.leavingAt==30 and view.project.loopStart==nil and three.pos==24 and three.state==1)
three.pos=30.1;scheduler.tick();assert(three.state==1 and three.repeatMode==0)
three.pos=90.1;scheduler.tick();scheduler.tick();assert(three.state==0 and three.loopA==50 and three.repeatMode==1)
local source=three.tracks[3]
command(c,"arm",{track=source.guid,on=false})
local prepared=H.rehearsal_state({project=c}).project
assert(#prepared.recordTracks==2 and not prepared.recordTracks[1].armed)
command(c,"arm",{track=source.guid,on=true})
assert(source.values.I_RECARM==1 and two.tracks[1].values.I_RECARM==0)
local created=command(c,"input",{index=3,name="Guitare"})
assert(created.project.armed==3 and three.tracks[1].values.I_RECINPUT==2)
assert(not pcall(command,b,"arm",{track=source.guid,on=true}))
assert(not pcall(command,c,"input",{index=80}))
command(c,"seek",{position=30})
assert(three.cursor==30)
-- Selecting a configured row only creates a track when its input is missing.
local before=#three.tracks
command(c,"configuredInput",{index=3,name="Console guitar",stereo=false})
assert(#three.tracks==before and three.tracks[1].values.I_RECARM==1)
local keys=track("Keys",nil)
keys.values.I_RECINPUT=1024+3
table.insert(three.tracks,keys)
command(c,"configuredInput",{index=4,name="Keys",stereo=true})
assert(#three.tracks==before+1 and keys.values.I_RECARM==1)
command(c,"arm",{track=keys.guid,on=false})
assert(keys.values.I_RECARM==0)
-- A backing track carrying audio must not become a record track.
local media=track("Backing",nil,{{start=0,length=30}})
media.values.I_RECINPUT=1024+5
table.insert(three.tracks,media)
command(c,"configuredInput",{index=6,name="Backing",stereo=true})
local added=three.tracks[1]
assert(added~=media and media.values.I_RECARM==0 and added.values.I_RECINPUT==1024+5)
command(c,"configuredInput",{index=6,name="Backing",stereo=true})
assert(#three.tracks==before+3 and three.tracks[1]==added)
assert(not pcall(command,c,"configuredInput",{index=18,name="Unavailable",stereo=true}))
-- A stems-only project with neither a reference mix nor an end marker plays to its last item.
local stems=project("Stems")
stems.tracks={track("Drums",nil,{{start=1,length=3}}),track("Keys",nil,{{start=0,length=8}})}
stems.marks={}
local stemId=H.rehearsal_state({}).tabs[4].id
local preparedStems=command(stemId,"select",{}).project
assert(not preparedStems.original and preparedStems.ending==8)
assert(command(stemId,"play",{source="backing"}).project.stopAt==8)
command(stemId,"stop",{})
table.remove(projects,4)
-- The count-in item precedes the reference mix. Whole-song playback starts at project zero.
local guideProject=project("Count-in")
guideProject.tracks[1].items={{start=3.74,length=80}}
local click=track("Métronome",nil,{{start=4,length=79}})
local calls=track("Appels de régions",nil,{{start=3.74,length=79}})
local intro=track("Décompte",nil,{{start=0,length=3.74}})
click.values.D_VOL=1.28;calls.values.D_VOL=0.9;intro.values.D_VOL=0.8
for _,tr in ipairs({click,calls,intro}) do table.insert(guideProject.tracks,tr) end
local gid=H.rehearsal_state({}).tabs[4].id
local mix=command(gid,"play",{source="backing"}).project
assert(mix.start==0 and mix.pos==0 and intro.values.B_MUTE==0 and #mix.guides==3)
assert(mix.guides[1].volume==1.28 and mix.guides[2].volume==0.9)
guideProject.pos=2
command(gid,"guideVolume",{track=calls.guid,volume=0.45})
assert(click.values.D_VOL==1.28 and calls.values.D_VOL==0.45 and guideProject.pos==2 and guideProject.state==1)
command(gid,"guideVolume",{track=intro.guid,volume=0.6})
assert(intro.values.D_VOL==0.6 and calls.values.D_VOL==0.45 and click.values.D_VOL==1.28)
assert(not pcall(command,gid,"guideVolume",{track=guideProject.tracks[2].guid,volume=1}))
assert(not pcall(command,gid,"guideVolume",{track=click.guid,volume=-1}))
assert(not pcall(command,c,"guideVolume",{track=click.guid,volume=1}))
command(gid,"stop")
assert(calls.values.D_VOL==0.45)
table.remove(projects,4)
-- A 3/4 bar before a 4/4 bar, with a tempo change at their boundary.
local chart=project("Mixed meters")
chart.marks={{1,0,"Verse",7},{2,7,"Chorus",11},{3,11,"Bridge",15}}
r.EnumProjectMarkers3=function(p,i)
 local m=p.marks[i+1];return 1,m[4]~=nil,m[2],m[4] or 0,m[3],m[1]
end
r.GetLastMarkerAndCurRegion=function(p,t)
 local marker,region=-1,-1
 for i,m in ipairs(p.marks) do
  if m[2]<=t then
   if m[4] and t<m[4] then region=i-1 elseif not m[4] then marker=i-1 end
  end
 end
 return marker,region
end
chart.state=1;chart.pos=2;chart.repeatMode=0
local forward=H.rehearsal_sheet_clock().cue
assert(forward.name=="Chorus" and not forward.repeatSection and forward.twoAt==1.5 and forward.oneAt==3 and forward.at==7)
chart.loopA=0;chart.loopB=7;chart.repeatMode=1
local wrap=H.rehearsal_sheet_clock().cue
assert(wrap.name=="Verse" and wrap.repeatSection and wrap.twoAt==forward.twoAt)
chart.loopB=11
assert(H.rehearsal_sheet_clock().cue.name=="Chorus")
chart.pos=8
assert(H.rehearsal_sheet_clock().cue.name=="Verse")
chart.state=0;table.remove(projects,4)
-- Closing a tab must not redirect old commands to another open project.
table.remove(projects,3)
assert(not pcall(command,c,"play",{source="original"}))
assert(one.state==0 and two.state==0)
local reloaded=dofile("integrations/BandPilot_Rehearsal.lua")({},r)
assert(reloaded~=nil)
print("rehearsal-tabs: duplicate titles, scoped playback, ranges, loop, recording separation, partial stop, marker, restores, autosave and tab closure passed")
