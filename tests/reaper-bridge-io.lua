-- Run the actual deferred loop with Windows-style transient rename failures.
local files, next_loop, actions, fail_once = {}, nil, 0, true
local request_locked = true
if arg[1]=='windows' then package.config=string.char(92)..string.char(10) end
local sep=package.config:sub(1,1)
local dir='/virtual'..sep..'XR18Studio'
local native_io, native_remove, native_rename=io.open,os.remove,os.rename
io.open=function(path,mode)
 if mode=='w' then
  local buffer=''
  return {write=function(_,s)buffer=buffer..s end,close=function()files[path]=buffer end}
 end
 if not files[path] then return nil end
 return {read=function()return files[path]end,close=function()end}
end
os.remove=function(path)
 if request_locked and path==dir..sep..'request.lua' then request_locked=false;return nil,'permission denied' end
 files[path]=nil;return true
end
os.rename=function(a,b)
 if fail_once and b==dir..sep..'response.json' then fail_once=false;return nil,'permission denied' end
 files[b]=files[a];files[a]=nil;return true
end
reaper={
 GetResourcePath=function()return '/virtual'end,RecursiveCreateDirectory=function()end,
 time_precise=function()return 10 end,defer=function(fn)next_loop=fn end,atexit=function()end,
 Main_OnCommand=function()actions=actions+1 end,GetPlayState=function()return 5 end,
 GetPlayPosition=function()return 1 end,GetCursorPosition=function()return 0 end,
 EnumerateFiles=function(_,i)
  local names={} for path in pairs(files)do names[#names+1]=path:sub(#dir+2)end
  table.sort(names);return names[i+1]
 end
}
files[dir..sep..'request.lua']='{id="legacy",cmd="action",args={ids={1013}}}'
files[dir..sep..'request-a1.lua']='{id="a1",cmd="transport"}'
files[dir..sep..'request-b2.lua']='{id="b2",cmd="transport"}'
dofile('integrations/XR18_Studio_Bridge.lua')
assert(actions==0 and next_loop,'locked requests must not execute until consumed')
next_loop()
assert(actions==1)
assert(not files[dir..sep..'response.json'],'first Windows write should fail')
assert(files[dir..sep..'response-a1.json']:find('"id":"a1"',1,true))
assert(files[dir..sep..'response-b2.json']:find('"id":"b2"',1,true))
next_loop()
assert(actions==1,'retry must never toggle Rec a second time')
assert(files[dir..sep..'response.json']:find('"id":"legacy"',1,true))
assert(files[dir..sep..'heartbeat.txt']:find('BandPilotBridge/2',1,true))
io.open,os.remove,os.rename=native_io,native_remove,native_rename
print('REAPER bridge I/O regressions passed')
