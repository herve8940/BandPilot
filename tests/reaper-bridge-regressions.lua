-- Executes the production bridge against a small REAPER API double, including empty take slots.
local project, recording, repeat_on, first, last = 'test.rpp', 0, 0, 0, 0
local good = {valid=true}
local tracks = {
 {name='REC Batterie',mute=0,armed=1,items={{pos=0,len=10,takes={good},count=3}}},
 {name='REC Basse',mute=1,armed=0,items={{pos=0,len=10,takes={},count=3}}},
 {name='Batterie',mute=1,armed=0,items={}},
 {name='Basse',mute=0,armed=0,items={}}
}
reaper = {
 GetResourcePath=function() return '/tmp' end, RecursiveCreateDirectory=function()end,
 EnumProjects=function()return nil,project end, GetPlayState=function()return recording end,
 CountTracks=function()return #tracks end, GetTrack=function(_,i)return tracks[i+1]end,
 GetTrackName=function(tr)return true,tr.name end,
 GetMediaTrackInfo_Value=function(tr,k)if k=='I_RECARM' then return tr.armed end return tr.mute end,
 SetMediaTrackInfo_Value=function(tr,k,v)tr.mute=v end,
 CountTrackMediaItems=function(tr)return #tr.items end, GetTrackMediaItem=function(tr,i)return tr.items[i+1]end,
 GetMediaItemInfo_Value=function(it,k)return k=='D_POSITION' and it.pos or it.len end,
 CountTakes=function(it)return it.count end, GetTake=function(it,i)return it.takes[i+1]end,
 ValidatePtr2=function(_,p) return type(p)=='table' and p.valid~=false end,
 SetActiveTake=function(t)assert(t and t.valid);t.selected=true end, UpdateArrange=function()end,
 GetSetRepeat=function(v)if v~=-1 then repeat_on=v end return repeat_on end,
 GetSet_LoopTimeRange=function(set,_,a,b)if set then first,last=a,b end return first,last end
}
XR18_BRIDGE_NO_LOOP=true
dofile('integrations/XR18_Studio_Bridge.lua')
local H=XR18_BRIDGE.H
local result=H.select_take({take=0,start=0,stop=10,project=project})
assert(result.changed==1 and result.skipped==1 and good.selected)
local ok,err=pcall(H.select_take,{take=2,start=0,stop=10});assert(not ok and tostring(err):find('vide'))
assert(not pcall(H.select_take,{take=-1,start=0,stop=10}))
assert(not pcall(H.select_take,{take=.5,start=0,stop=10}))
assert(not pcall(H.select_take,{take=0,start=0,stop=10,project='other.rpp'}))
H.listen_original({on=true,project=project})
assert(tracks[1].mute==1 and tracks[2].mute==1 and tracks[3].mute==0 and tracks[4].mute==0)
H.listen_original({on=true,project=project}) -- repeated request must not overwrite the saved mix
H.listen_original({on=false,project=project})
assert(tracks[1].mute==0 and tracks[2].mute==1 and tracks[3].mute==1 and tracks[4].mute==0)
local loop=H.set_loop({on=true,start=2,stop=5,project=project})
assert(loop.on and loop.start==2 and loop.stop==5)
assert(not pcall(H.set_loop,{on=true,start=5,stop=2}))
assert(not H.set_loop({on=false}).on)
recording=4
assert(not pcall(H.select_take,{take=0,start=0,stop=10}))
assert(not pcall(H.listen_original,{on=true}))
assert(not pcall(H.set_loop,{on=true,start=2,stop=5}))
print('REAPER bridge regressions passed')
