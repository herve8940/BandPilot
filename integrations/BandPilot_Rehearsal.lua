-- A rehearsal owns one REAPER transport and uses new, empty audio input tracks for each pass.
return function(H, r, helpers)
  local section, takeKey = "BandPilotRehearsal", "P_EXT:BandPilotRehearsalTake"
  local inputKey = "P_EXT:BandPilotRecordInput"
  local projects, sequence = {}, 0
  local generation = r.genGuid():gsub("[^%x]", "")
  local session, notice
  local stopAndSave = 40667 -- Transport: Stop (save all recorded media).
  local normalRecord = 40252
  local punchModes = {40253, 40076}
  local function get(tr, key) return r.GetMediaTrackInfo_Value(tr, key) end
  local function set(tr, key, value)
    assert(r.SetMediaTrackInfo_Value(tr, key, value), "Réglage de piste refusé par REAPER.")
  end
  local function ext(p, key)
    local _, value = r.GetProjExtState(p, section, key)
    return value
  end
  local function config(p, key, value) r.SetProjExtState(p, section, key, value) end
  local function trackString(tr, key, value)
    local _, text = r.GetSetMediaTrackInfo_String(tr, key, value or "", value ~= nil)
    return text
  end
  local function tracks(p)
    local list = {}
    for i = 0, r.CountTracks(p) - 1 do list[#list + 1] = r.GetTrack(p, i) end
    return list
  end
  local function tabList()
    local list, alive = {}, {}
    local current = r.EnumProjects(-1, "")
    local i = 0
    while true do
      local p, path = r.EnumProjects(i, "")
      if not p then break end
      if not projects[p] then
        sequence = sequence + 1
        projects[p] = generation .. "-" .. sequence
      end
      alive[p] = projects[p]
      local file = path and path:match("([^/\\]+)$")
      local title = (r.GetProjectName(p) or ""):gsub("%.[rR][pP][pP]$", "")
      if title == "" and file then title = file:gsub("%.[rR][pP][pP]$", "") end
      list[#list + 1] = { p=p, path=path, id=alive[p], title=title, number=i+1, saved=path ~= nil and path ~= "", current=p == current }
      i = i + 1
    end
    projects = alive
    return list
  end
  local function state(p) return r.GetPlayStateEx(p) end
  local function tabFor(list, id)
    for _, tab in ipairs(list) do if tab.id == id then return tab end end
  end
  local function modeFor(list)
    for _, tab in ipairs(list) do
      local play = state(tab.p)
      if (play & 4) ~= 0 then return tab,"recording" end
      if (play & 1) ~= 0 then return tab,"playing" end
      if (play & 2) ~= 0 then return tab,"paused" end
    end
  end
  local function markers(p)
    local out, regions = {}, {}
    local count = r.CountProjectMarkers(p)
    for i = 0, count - 1 do
      local ok, region, pos, ending, name, id = r.EnumProjectMarkers3(p, i)
      if ok ~= 0 then
        out[#out + 1] = { id=(region and "r" or "m") .. id, pos=pos, name=name }
        if region and ending > pos then
          out[#out + 1] = { id="e" .. id, pos=ending, name=name, ending=true }
          regions[#regions+1]={start=pos,stop=ending,name=name}
        end
      end
    end
    table.sort(out, function(a,b) return a.pos < b.pos end)
    return out, regions
  end
  local function bounds(tr)
    local first, last
    for i=0,r.CountTrackMediaItems(tr)-1 do
      local it = r.GetTrackMediaItem(tr,i)
      local pos = r.GetMediaItemInfo_Value(it,"D_POSITION")
      local ending = pos + r.GetMediaItemInfo_Value(it,"D_LENGTH")
      if ending > pos then first = math.min(first or pos,pos); last = math.max(last or ending,ending) end
    end
    return first, last
  end
  local function pass(tr)
    local id, number, stamp, plannedStart, plannedEnd, partial = trackString(tr,takeKey):match("^([%x%-]+)|(%d+)|(%d+)|([%d.]+)|([%d.]+)|([01])$")
    return id, tonumber(number), tonumber(stamp), tonumber(plannedStart), tonumber(plannedEnd), partial == "1"
  end
  local function tag(tr, passId, number, stamp, first, last, partial)
    trackString(tr,takeKey,string.format("%s|%d|%d|%.6f|%.6f|%d",passId,number,stamp,first,last,partial and 1 or 0))
  end
  local function recordInput(tr,count)
    local input = math.floor(get(tr,"I_RECINPUT"))
    if get(tr,"I_RECMODE")~=0 or input<0 or (input&4096)~=0 then return {},false end
    local size = (input&2048)~=0 and math.floor(get(tr,"I_NCHAN")) or ((input&1024)~=0 and 2 or 1)
    local first=(input&1023)+1
    local channels={}
    for i=first,first+size-1 do channels[#channels+1]=i end
    return channels,size>0 and first+size-1<=count
  end
  local function byTrackId(list,id)
    for _,tr in ipairs(list) do if r.GetTrackGUID(tr)==id then return tr end end
  end
  local function isRecordTrack(tr)
    return not pass(tr) and (get(tr,"I_RECARM")==1 or trackString(tr,inputKey)=="1" or trackString(tr,"P_NAME"):match("^[Rr][Ee][Cc][ %-%_]"))
  end
  local guideNames={
    ["métronome"]=true,metronome=true,metronom=true,metronomo=true,["metrónomo"]=true,click=true,["click track"]=true,
    ["appels de régions"]=true,["appels de sections"]=true,["appels de section"]=true,
    ["décompte"]=true,["décompte de départ"]=true,["décompte des régions"]=true,["décomptes"]=true,
    ["count-in"]=true,["count in"]=true,countdown=true,["region count-in"]=true,["section count-in"]=true,
    ["compte à rebours"]=true,["cuenta atrás"]=true,["conteggio iniziale"]=true,["einzähler"]=true,
    ["section calls"]=true,["section cues"]=true,["region calls"]=true,["region cues"]=true,
    ["annunci di sezione"]=true,["avisos de sección"]=true,abschnittsansagen=true,
  }
  local function isGuide(tr)
    local name=trackString(tr,"P_NAME"):gsub("É","é"):gsub("Ó","ó"):lower():match("^%s*(.-)%s*$")
    return guideNames[name] and not pass(tr)
  end
  local function details(tab)
    local p, list = tab.p, tracks(tab.p)
    local choices, captured, byId, armed, nextNumber={}, {}, {}, {}, 1
    local preferred, original, inferred = ext(p,"original"), nil, nil
    for _, tr in ipairs(list) do
      local key = r.GetTrackGUID(tr)
      local id, number, stamp, start, stop, partial = pass(tr)
      local title = trackString(tr,"P_NAME")
      if id then
        nextNumber = math.max(nextNumber, number+1)
        local first, last = bounds(tr)
        if first and last then
          local group = byId[id]
          if not group then
            group = { id=id, number=number, stamp=stamp, first=math.max(start,first),
              last=math.min(stop,last), partial=partial, tracks={} }
            byId[id]=group; captured[#captured+1]=group
          else
            group.first=math.max(start,math.min(group.first,first))
            group.last=math.min(stop,math.max(group.last,last))
          end
          group.tracks[#group.tracks+1]=tr
        end
      else
        if get(tr,"I_RECARM") == 1 then armed[#armed+1]=tr end
        if r.CountTrackMediaItems(tr) > 0 then
          choices[#choices+1]={id=key,name=title}
          if key == preferred then original=tr end
          local name = title:lower():gsub("^%s+",""):gsub("%s+$","")
          if not inferred and (name == "original" or name:match("^original[%s_%-]")) then inferred=tr end
        end
      end
    end
    if preferred == "" then original = inferred end
    local marks, regions = markers(p)
    local markerId = ext(p,"end")
    local first, ending = 0, nil
    if original then
      local _,last=bounds(original)
      ending=last
    end
    for _, mark in ipairs(marks) do
      if mark.pos > first and (mark.id == markerId or markerId == "" and not mark.ending and mark.name:lower():match("^%s*fin%s*$")) then ending=mark.pos; break end
    end
    if not ending then
      for _,tr in ipairs(list) do
        if not isRecordTrack(tr) and not pass(tr) then
          local _,last=bounds(tr)
          if last and last>first then ending=math.max(ending or 0,last) end
        end
      end
    end
    for i=#captured,1,-1 do
      if captured[i].last <= captured[i].first or (session and session.passId == captured[i].id) then table.remove(captured,i) end
    end
    table.sort(captured,function(a,b) return a.number>b.number end)
    return { list=list, original=original, choices=choices, takes=captured, byId=byId, armed=armed, nextNumber=nextNumber,
      first=first, last=ending, marks=marks, regions=regions, endMarker=markerId, autoSave=ext(p,"autosave")=="1" }
  end
  local function recordProblem(tab,d)
    if not tab.saved then return "Enregistre d’abord le projet REAPER sur le Mac." end
    if #d.armed == 0 then return "Aucune piste d’entrée armée dans ce morceau." end
    local inputs = r.GetNumAudioInputs()
    for _, tr in ipairs(d.armed) do
      local _,available=recordInput(tr,inputs)
      if not available then
        return "Vérifie les entrées audio et le mode Enregistrer l’entrée des pistes armées dans REAPER."
      end
    end
  end
  local function snapshot(list, id, detail, known)
    local busy, transport = modeFor(list)
    local active = session and tabFor(list,session.id) or busy
    local tabs = {}
    for _, tab in ipairs(list) do
      tabs[#tabs+1]={id=tab.id,number=tab.number,title=tab.title,saved=tab.saved,current=tab.current,duration=r.GetProjectLength(tab.p)}
    end
    local tab = active or tabFor(list,id)
    if not tab and (not id or id == "") then
      for _, candidate in ipairs(list) do if candidate.current then tab=candidate;break end end
      tab=tab or list[1]
    end
    local phase=session and session.starting and "starting" or transport or "idle"
    local result={tabs=tabs,active=active and active.id,transport=phase,owned=session~=nil,notice=notice}
    if not tab then return result end
    local p = tab.p
    local pos=state(p)~=0 and r.GetPlayPositionEx(p) or r.GetCursorPositionEx(p)
    local count=r.GetNumAudioInputs()
    local revision=table.concat({tab.id,r.GetProjectStateChangeCount(p),count,phase,
      session and session.countInTo or "",session and session.source or "",session and session.first or "",session and session.last or "",session and tostring(session.loop) or "",tab.saved and 1 or 0,r.IsProjectDirty(p),detail and 1 or 0},":")
    result.revision=revision
    result.rate=r.Master_GetPlayRate(p)
    if known==revision then result.position=pos;return result end
    local d = details(tab)
    local selections={}
    for _, take in ipairs(d.takes) do
      selections[#selections+1]={id=take.id,number=take.number,stamp=take.stamp,first=take.first,last=take.last,partial=take.partial,channels=#take.tracks}
    end
    local currentSession = session and session.id == tab.id and session
    local recordTracks={}
    for _,tr in ipairs(d.list) do
      local name=trackString(tr,"P_NAME")
      local armed=get(tr,"I_RECARM")==1
      if tr~=d.original and isRecordTrack(tr) then
        local channels,available=recordInput(tr,count)
        recordTracks[#recordTracks+1]={id=r.GetTrackGUID(tr),name=name,channels=channels,available=available,armed=armed}
      end
    end
    result.project={id=tab.id,original=d.original and r.GetTrackGUID(d.original),choices=d.choices,marks=d.marks,
      start=d.first,ending=d.last,endMarker=d.endMarker,autoSave=d.autoSave,takes=selections,
      inputs=math.min(128,count),recordTracks=recordTracks,armed=#d.armed,recordProblem=not busy and recordProblem(tab,d) or nil,
      pos=pos,
      playTake=currentSession and currentSession.takeId,during=currentSession and currentSession.kind,stopAt=currentSession and currentSession.last,
      countInTo=currentSession and currentSession.countInTo,
      leavingAt=currentSession and not currentSession.loop and currentSession.loopEnd or nil,
      loopStart=currentSession and currentSession.loop and currentSession.first or nil,
      source=currentSession and currentSession.source,dirty=r.IsProjectDirty(p)~=0}
    local backing,guides={},{}
    for _,tr in ipairs(d.list) do
      if tr~=d.original and isGuide(tr) then
        guides[#guides+1]={id=r.GetTrackGUID(tr),name=trackString(tr,"P_NAME"),volume=get(tr,"D_VOL"),mute=get(tr,"B_MUTE")==1}
      end
      if tr~=d.original and not pass(tr) and r.CountTrackMediaItems(tr)>0 then
        backing[#backing+1]={id=r.GetTrackGUID(tr),name=trackString(tr,"P_NAME"),mute=get(tr,"B_MUTE")==1}
      end
    end
    result.project.guides=guides
    result.project.backing=backing
    if detail then
      local viewTracks={}
      for index,tr in ipairs(d.list) do
        viewTracks[#viewTracks+1]={id=r.GetTrackGUID(tr),index=index-1,name=trackString(tr,"P_NAME"),
          rec=pass(tr)~=nil,mute=get(tr,"B_MUTE")==1,solo=get(tr,"I_SOLO")~=0,armed=get(tr,"I_RECARM")==1,
          items=helpers.items(tr,p)}
      end
      result.project.picture={tracks=viewTracks,regions=d.regions}
    end
    return result
  end
  local function change(s,tr,key,value)
    local old=get(tr,key)
    if old == value then return end
    s.changed[#s.changed+1]={tr=tr,key=key,old=old,value=value}
    set(tr,key,value)
  end
  -- The config API addresses the focused tab. If the musician switches tabs
  -- during the count, restore that tab when it becomes current again.
  local pendingMetro={}
  local function restoreMetro(s)
    if not s.metro then return end
    local original=s.metro
    pendingMetro[s.p]=original
    s.metro=nil
    s.countInTo=nil
  end
  local function flushMetro()
    if not next(pendingMetro) then return end
    local p=r.EnumProjects(-1,"")
    local metro=pendingMetro[p]
    if metro then
      for _,setting in ipairs(metro) do
        local ok,value=r.get_config_var_string(setting.key)
        if ok and tonumber(value)==setting.applied then
          r.set_config_var_string(setting.key,setting.before,0)
        end
      end
      pendingMetro[p]=nil
    end
    for tab in pairs(pendingMetro) do
      if not r.ValidatePtr(tab,"ReaProject*") then pendingMetro[tab]=nil end
    end
  end
  local function countIn(s,bars,start)
    if bars==nil then return end
    assert(r.get_config_var_string and r.set_config_var_string,"Le décompte réglable nécessite une version récente de REAPER.")
    assert(r.EnumProjects(-1,"")==s.p,"REAPER n’a pas sélectionné le morceau demandé.")
    flushMetro()
    local ok,value=r.get_config_var_string("projmetroen")
    assert(ok and tonumber(value),"Le métronome de REAPER est indisponible.")
    local flags=tonumber(value)
    -- Preserve a running playback click only if it was already audible.
    local enabled=bars>0 and ((flags | 9) & ((flags & 1)==1 and -1 or ~2)) or (flags & ~8)
    s.metro={}
    local function apply(key,wanted)
      local available,before=r.get_config_var_string(key)
      assert(available and tonumber(before),"Le métronome de REAPER est indisponible.")
      if tonumber(before)~=wanted then
        s.metro[#s.metro+1]={key=key,before=before,applied=wanted}
        r.set_config_var_string(key,tostring(wanted),0)
        local _,after=r.get_config_var_string(key)
        assert(tonumber(after)==wanted,"Le métronome de REAPER est indisponible.")
      end
    end
    if bars>0 then apply("projmetrocountin",bars) end
    apply("projmetroen",enabled)
    s.countInTo=start
  end
  local function restore(s)
    restoreMetro(s)
    flushMetro()
    local p=s.p
    for i=#s.changed,1,-1 do
      local c=s.changed[i]
      if r.ValidatePtr2(p,c.tr,"MediaTrack*") and get(c.tr,c.key)==c.value then set(c.tr,c.key,c.old) end
    end
    if s.recordMode and r.GetToggleCommandStateEx(0,normalRecord)==1 then
      r.Main_OnCommandEx(s.recordMode,0,p)
    end
    if s.repeatBefore then
      local a,b=r.GetSet_LoopTimeRange2(p,false,true,0,0,false)
      if s.loopEnd and math.abs(a-s.first)<.001 and math.abs(b-s.loopEnd)<.001 then
        r.GetSet_LoopTimeRange2(p,true,true,s.oldLoopStart,s.oldLoopEnd,false)
      end
      if s.clearedSelection then
        local first,last=r.GetSet_LoopTimeRange2(p,false,false,0,0,false)
        if first==last and first==0 then r.GetSet_LoopTimeRange2(p,true,false,s.oldSelectionStart,s.oldSelectionEnd,false) end
        if a==b and a==0 then r.GetSet_LoopTimeRange2(p,true,true,s.oldLoopStart,s.oldLoopEnd,false) end
      end
      if r.GetSetRepeatEx(p,-1)==(s.loop and 1 or 0) then r.GetSetRepeatEx(p,s.repeatBefore) end
    end
  end
  local function loopSettings(s)
    local p=s.p
    s.repeatBefore=r.GetSetRepeatEx(p,-1)
    s.oldLoopStart,s.oldLoopEnd=r.GetSet_LoopTimeRange2(p,false,true,0,0,false)
    s.oldSelectionStart,s.oldSelectionEnd=r.GetSet_LoopTimeRange2(p,false,false,0,0,false)
    s.clearedSelection=not s.loop
    s.loopEnd=s.loop and s.last or nil
    if s.loop then r.GetSet_LoopTimeRange2(p,true,true,s.first,s.last,false)
    else r.GetSet_LoopTimeRange2(p,true,false,0,0,false) end
    r.GetSetRepeatEx(p,s.loop and 1 or 0)
  end
  local function finish(s)
    local p=s.p
    restore(s)
    if s.kind ~= "record" then return end
    local count=0
    local partial=not s.reachedEnd
    for _, tr in ipairs(s.created) do
      if r.ValidatePtr2(p,tr,"MediaTrack*") then
        set(tr,"I_RECARM",0)
        set(tr,"B_MUTE",1)
        set(tr,"B_MAINSEND",1)
        local first,last=bounds(tr)
        if first and last then
          tag(tr,s.passId,s.number,s.stamp,s.first,s.last,partial)
          count=count+1
        else
          r.DeleteTrack(tr) -- only an empty track created by this pass
        end
      end
    end
    if count>0 then
      r.MarkProjectDirty(p)
      if s.autoSave then r.Main_SaveProject(p,false) end
      notice={kind="take",number=s.number,project=s.id,partial=partial}
    else notice={kind="empty",project=s.id} end
    r.UpdateArrange()
  end
  local function stopOwned(s)
    s.starting=false
    if s.kind=="record" and (state(s.p) & 4)~=0 then r.Main_OnCommandEx(stopAndSave,0,s.p)
    else r.OnStopButtonEx(s.p) end
  end
  local function tick()
    flushMetro()
    local s=session
    if not s then return end
    local listed=false
    local i=0
    while true do
      local p=r.EnumProjects(i,"")
      if not p then break end
      if p==s.p then listed=true;break end
      i=i+1
    end
    if not listed then session=nil;return end
    local play=state(s.p)
    if s.starting then
      local running=s.kind=="record" and (play & 4)~=0 or s.kind=="play" and (play & 1)~=0
      if running then s.starting=false
      elseif r.time_precise()<s.deadline then return
      else
        s.startError=true
        stopOwned(s)
        play=state(s.p)
      end
    end
    if s.metro and not s.starting and (play & 1)~=0 and r.GetPlayPositionEx(s.p)>s.countInTo+.015 then
      restoreMetro(s);flushMetro()
    end
    if play==0 then
      session=nil
      finish(s)
      if s.startError then notice={kind="startError",project=s.id} end
    elseif s.kind=="record" and (play & 4)==0 then
      -- Finalization can leave playback running after a punch-out.
      stopOwned(s)
    elseif not s.loop and (play & 5)~=0 and r.GetPlayPositionEx(s.p)>=s.last then
      s.reachedEnd=true
      stopOwned(s)
    end
  end
  local function range(tab,d,a,take)
    local first,last=d.first,d.last
    if a.a or a.b then
      first,last=nil,nil
      for _, mark in ipairs(d.marks) do
        if mark.id==a.a then first=mark.pos end
        if mark.id==a.b then last=mark.pos end
      end
    end
    if take and first and last then first,last=math.max(first,take.first),math.min(last,take.last) end
    if take and (not a.a and not a.b) then first,last=take.first,take.last end
    assert(first and first>=0 and last and last>first+.049,"Choisis un début et une fin valides pour le morceau ou le passage.")
    return first,last
  end
  local function playbackStart(p,first,take,leadIn)
    if not leadIn then return first end
    local qn=r.TimeMap2_timeToQN(p,first)
    local _,bar=r.TimeMap_QNToMeasures(p,qn)
    local _,previous=r.TimeMap_QNToMeasures(p,bar-0.000001)
    local start=r.TimeMap2_QNToTime(p,math.min(bar,previous+qn-bar))
    return math.min(first,math.max(0,take and take.first or 0,start))
  end
  local function listen(s,d,source,take)
    local keep={}
    if source=="original" then
      assert(d.original,"Choisis la piste Original de ce morceau sur le Mac.")
      keep[d.original]=true
    elseif source=="take" then
      for _, tr in ipairs(take.tracks) do keep[tr]=true end
    end
    for _, tr in ipairs(d.list) do
      if source=="original" or source=="take" then
        change(s,tr,"I_SOLO",keep[tr] and 2 or 0)
        if keep[tr] then
          local parent=tr
          while parent do
            change(s,parent,"B_MUTE",0)
            parent=r.GetParentTrack(parent)
          end
        end
      else
        change(s,tr,"I_SOLO",0)
        if tr==d.original or pass(tr) then change(s,tr,"B_MUTE",1) end
      end
    end
  end
  local function capture(s,d)
    local p=s.p
    assert(#d.armed<=32,"32 pistes armées au maximum par prise.")
    for _, action in ipairs(punchModes) do
      if r.GetToggleCommandStateEx(0,action)==1 then
        s.recordMode=action
        r.Main_OnCommandEx(normalRecord,0,p)
        assert(r.GetToggleCommandStateEx(0,normalRecord)==1,"Le mode d’enregistrement normal n’a pas été confirmé.")
        break
      end
    end
    -- Use recording-only tracks so repeated/overlapping passes cannot replace existing items.
    -- Keep input monitoring and FX on the original armed tracks.
    for _, tr in ipairs(d.armed) do change(s,tr,"I_RECMODE",2) end
    for i,tr in ipairs(d.armed) do
      r.InsertTrackAtIndex(i-1,false)
      local target=assert(r.GetTrack(p,i-1),"REAPER ne peut pas ajouter la piste d’enregistrement.")
      s.created[#s.created+1]=target
      local name=trackString(tr,"P_NAME")
      trackString(target,"P_NAME","BP " .. s.number .. " · " .. (name~="" and name or ("Entrée " .. i)))
      tag(target,s.passId,s.number,s.stamp,s.first,s.last,true)
      set(target,"I_NCHAN",get(tr,"I_NCHAN"))
      set(target,"I_RECINPUT",get(tr,"I_RECINPUT"))
      set(target,"I_RECMODE",0)
      set(target,"I_RECMON",0)
      set(target,"B_MAINSEND",0)
      set(target,"I_RECARM",1)
    end
  end
  function H.rehearsal_peaks(a)
    local tab=assert(tabFor(tabList(),a.project),"Cet onglet REAPER a été fermé. Choisis un morceau.")
    local tr=assert(byTrackId(tracks(tab.p),a.track),"Piste introuvable.")
    return helpers.peaks(tr,a)
  end
  local function previousBar(p,time)
    if time<=0 then return 0 end
    local qn=r.TimeMap2_timeToQN(p,time)
    local _,bar=r.TimeMap_QNToMeasures(p,qn)
    local _,previous=r.TimeMap_QNToMeasures(p,bar-0.000001)
    return math.max(0,r.TimeMap2_QNToTime(p,math.min(bar,previous+qn-bar)))
  end
  local function sectionCue(p,pos,left,right,looping,lastMarker,region)
    local target,at,repeatSection
    -- REAPER enumerates markers and regions in timeline order.
    for i=math.max(lastMarker,region)+1,r.CountProjectMarkers(p)-1 do
      local ok,isRegion,start,_,name=r.EnumProjectMarkers3(p,i)
      if ok~=0 and isRegion and start>pos and name~="" then
        at,target=start,name
        break
      end
    end
    if looping and (not at or right<=at+0.000001) then
      local _,index=r.GetLastMarkerAndCurRegion(p,left+math.min(0.000001,(right-left)/2))
      target=""
      if index>=0 then local _,_,_,_,name=r.EnumProjectMarkers3(p,index);target=name end
      at,repeatSection=right,true
    end
    if not at then return end
    local one=previousBar(p,at)
    return {name=target,at=at,oneAt=one,twoAt=previousBar(p,one),repeatSection=repeatSection==true}
  end
  function H.rehearsal_sheet_clock()
    local list=tabList()
    local busy=modeFor(list)
    local tab=session and tabFor(list,session.id) or busy
    if not tab then for _,candidate in ipairs(list) do if candidate.current then tab=candidate;break end end end
    if not tab then return {} end
    local p=tab.p
    local playing=state(p)
    local pos=playing~=0 and r.GetPlayPositionEx(p) or r.GetCursorPositionEx(p)
    local lastMarker,region=r.GetLastMarkerAndCurRegion(p,pos)
    local name
    if region>=0 then
      local _,_,_,_,title=r.EnumProjectMarkers3(p,region)
      name=title
    end
    local left,right=r.GetSet_LoopTimeRange2(p,false,true,0,0,false)
    local looping=(playing&1)~=0 and r.GetSetRepeatEx(p,-1)==1 and right>left and pos<right
    return {project=tab.id,path=tab.path or "",title=tab.title,position=pos,section=name,
      cue=(playing&1)~=0 and sectionCue(p,pos,left,right,looping,lastMarker,region) or nil,playing=(playing&1)~=0,
      rate=r.Master_GetPlayRate(p),loop=looping,loopStart=looping and left or nil,loopEnd=looping and right or nil}
  end
  function H.rehearsal_state(a) return snapshot(tabList(),a.project,a.detail==true,a.known) end
  function H.rehearsal_command(a)
    local list=tabList()
    local tab=assert(tabFor(list,a.project),"Cet onglet REAPER a été fermé. Choisis un morceau.")
    local p, action=tab.p,a.action
    local busy=modeFor(list)
    if action=="stop" then
      assert(session and session.id==tab.id,"Cette lecture ou prise est pilotée depuis REAPER.")
      stopOwned(session)
      tick()
    elseif action=="guideVolume" then
      assert((not busy or busy.id==tab.id) and (not session or session.p==p),"Un autre morceau est en cours.")
      local d=details(tab)
      local tr=assert(byTrackId(d.list,a.track),"Piste introuvable.")
      assert(tr~=d.original and isGuide(tr) and type(a.volume)=="number" and a.volume>=0 and a.volume<=4,"Commande de répétition invalide.")
      set(tr,"D_VOL",a.volume)
      r.MarkProjectDirty(p)
    elseif action=="leaveLoop" then
      local s=session
      assert(s and s.p==p and s.kind=="play" and s.loop,"Aucune boucle en cours.")
      -- Disable the next wrap. Leave the audio cursor exactly where it is.
      r.GetSetRepeatEx(p,0)
      s.loop=false
      s.last=math.max(s.last,s.continueEnd)
    elseif action=="section" then
      local s=session
      assert(s and s.p==p and s.kind=="play" and not s.starting,"Aucune lecture à mettre en pause.")
      local d=details(tab)
      local take=s.takeId and assert(d.byId[s.takeId],"Cette prise est introuvable.")
      local first,last=range(tab,d,a,take)
      local start=playbackStart(p,first,take,a.leadIn)
      s.first,s.last,s.loop,s.loopEnd=first,last,true,last
      r.GetSet_LoopTimeRange2(p,true,true,first,last,false)
      r.GetSetRepeatEx(p,1)
      r.SetEditCurPos2(p,start,true,true)
      if (state(p) & 2)~=0 then r.OnPlayButtonEx(p) end
    elseif action=="pause" then
      assert(session and session.id==tab.id and session.kind=="play" and not session.starting,"Aucune lecture à mettre en pause.")
      if (state(p) & 2)~=0 then r.OnPlayButtonEx(p) else r.OnPauseButtonEx(p) end
    elseif action=="marker" then
      assert(not busy or busy.id==tab.id,"Un autre morceau est en cours.")
      local pos=state(p)~=0 and r.GetPlayPositionEx(p) or r.GetCursorPositionEx(p)
      local id=r.AddProjectMarker2(p,false,pos,0,a.name or "À revoir",-1,0)
      assert(id>=0,"Le repère n’a pas été ajouté.")
      notice={kind="marker",project=tab.id}
    else
      assert(not busy and not session,"Arrête la lecture ou l’enregistrement avant de changer de morceau.")
      notice=nil
      local d=details(tab)
      if action=="select" then
        r.SelectProjectInstance(p)
      elseif action=="setup" then
        if a.original then
          local found=false
          for _, option in ipairs(d.choices) do if option.id==a.original then found=true end end
          assert(a.original=="" or found,"Piste Original introuvable.")
          config(p,"original",a.original)
        end
        if a.endMarker then
          local found=false
          for _, mark in ipairs(d.marks) do if mark.id==a.endMarker and mark.pos>d.first then found=true end end
          assert(a.endMarker=="" or found,"Repère de fin introuvable.")
          config(p,"end",a.endMarker)
        end
        if a.autoSave~=nil then config(p,"autosave",a.autoSave and "1" or "0") end
        r.MarkProjectDirty(p)
      elseif action=="arm" then
        local tr=assert(byTrackId(d.list,a.track),"Piste introuvable.")
        assert(tr~=d.original and isRecordTrack(tr),"Choisis une piste d’entrée.")
        local _,available=recordInput(tr,r.GetNumAudioInputs())
        assert(not a.on or available,"Cette entrée audio est indisponible.")
        trackString(tr,inputKey,"1")
        set(tr,"I_RECARM",a.on and 1 or 0)
        r.MarkProjectDirty(p)
      elseif action=="input" or action=="configuredInput" then
        local last=a.index+(a.stereo and 1 or 0)
        assert(a.index>=1 and last<=r.GetNumAudioInputs(),"Cette entrée audio est indisponible.")
        local input=a.index-1+(a.stereo and 1024 or 0)
        local tr
        if action=="configuredInput" then
          for _,candidate in ipairs(d.list) do
            if candidate~=d.original and not pass(candidate) and get(candidate,"I_RECMODE")==0 and get(candidate,"I_RECINPUT")==input then
              if isRecordTrack(candidate) or (trackString(candidate,"P_NAME")==a.name and r.CountTrackMediaItems(candidate)==0) then
                tr=candidate
                break
              end
            end
          end
        end
        if not tr then
          r.SelectProjectInstance(p)
          assert(r.EnumProjects(-1,"")==p,"REAPER n’a pas sélectionné le morceau demandé.")
          r.InsertTrackAtIndex(0,false)
          tr=assert(r.GetTrack(p,0),"REAPER ne peut pas ajouter la piste d’enregistrement.")
          trackString(tr,"P_NAME",a.name or ("REC " .. a.index))
          set(tr,"I_RECINPUT",input)
          set(tr,"I_RECMODE",0)
          set(tr,"I_RECMON",0)
        end
        trackString(tr,inputKey,"1")
        set(tr,"I_RECARM",1)
        r.MarkProjectDirty(p)
        r.UpdateArrange()
      elseif action=="seek" then
        assert(a.position<=math.max(r.GetProjectLength(p),d.last or 0),"Position hors du morceau.")
        r.SetEditCurPos2(p,a.position,true,false)
      elseif action=="track" then
        local tr=assert(byTrackId(d.list,a.track),"Piste introuvable.")
        assert(not pass(tr),"Choisis la prise dans le panneau Prises.")
        local key=a.kind=="solo" and "I_SOLO" or "B_MUTE"
        set(tr,key,a.on and (key=="I_SOLO" and 2 or 1) or 0)
        r.UpdateArrange()
      elseif action=="save" then
        assert(tab.saved,"Enregistre d’abord le projet REAPER sur le Mac.")
        r.Main_SaveProject(p,false)
        notice={kind="saved",project=tab.id}
      elseif action=="play" or action=="record" then
        local recording=action=="record"
        local problem=recording and recordProblem(tab,d)
        assert(not problem,problem)
        local source=recording and "backing" or a.source
        local take=source=="take" and assert(d.byId[a.take],"Cette prise est introuvable.") or nil
        local first,last=range(tab,d,a,take)
        local start=playbackStart(p,first,take,not recording and a.leadIn)
        local s={continueEnd=take and take.last or d.last or r.GetProjectLength(p),p=p,id=tab.id,kind=action,source=source,takeId=a.take,first=first,last=last,changed={},created={},
          loop=not recording and a.loop==true,number=d.nextNumber,autoSave=d.autoSave,stamp=os.time(),
          passId=recording and r.genGuid():gsub("[^%x%-]","") or nil}
        local ok, problem=pcall(function()
          r.SelectProjectInstance(p)
          assert(r.EnumProjects(-1,"")==p,"REAPER n’a pas sélectionné le morceau demandé.")
          listen(s,d,source,take)
          loopSettings(s)
          r.SetEditCurPos2(p,start,true,false)
          if recording then capture(s,d) elseif s.loop then countIn(s,a.countBars,start) end
          s.starting=true
          s.deadline=r.time_precise()+5
          session=s
          if recording then r.Main_OnCommandEx(1013,0,p) else r.OnPlayButtonEx(p) end
          tick()
        end)
        if not ok then
          if state(p)~=0 then stopOwned(s) end
          session=nil
          finish(s)
          error(problem)
        end
      else error("Action de répétition inconnue.") end
    end
    return snapshot(tabList(),tab.id,a.detail==true)
  end
  return {
    tick=tick,
    active=function() return session~=nil end,
    exit=function()
      if session and projects[session.p]==session.id then
        stopOwned(session);tick()
      end
    end
  }
end
