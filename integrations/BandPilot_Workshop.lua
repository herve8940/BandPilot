-- Isolated, stopped REAPER project for virtual soundcheck. Never edits the source project.
return function(H, r, helpers)
  local function current() local p, path = r.EnumProjects(-1, ''); return p, path end
  local function stopped() assert(r.GetPlayState()==0, 'Arrête la lecture et l’enregistrement dans REAPER') end
  -- REAPER may close its device while BandPilot is in front. Reopen it on an explicit
  -- workshop command; Audio_Init leaves an already open device alone and never starts playback.
  local function audio() if r.GetNumAudioOutputs()==0 then r.Audio_Init() end end
  local function checked(a)
    local p, path=current()
    local _, id=r.GetProjExtState(p,'BandPilot','workshop')
    assert(id==a.id and path==a.project,'Projet atelier changé : reviens dans son onglet REAPER')
    assert((r.GetPlayState() & 4)==0,'Arrête l’enregistrement')
    return p
  end
  local function item_data(it)
    local take=r.GetActiveTake(it)
    if not take or r.TakeIsMIDI(take) then return nil end
    local src=r.GetMediaItemTake_Source(take)
    local file=r.GetMediaSourceFileName(src,'')
    if file=='' or not r.file_exists(file) then return nil end
    local channels=r.GetMediaSourceNumChannels(src)
    if channels<1 or channels>2 then return nil end
    return {pos=r.GetMediaItemInfo_Value(it,'D_POSITION'),length=r.GetMediaItemInfo_Value(it,'D_LENGTH'),
      file=file,channels=channels,take=r.GetTakeName(take),offset=r.GetMediaItemTakeInfo_Value(take,'D_STARTOFFS'),
      rate=r.GetMediaItemTakeInfo_Value(take,'D_PLAYRATE'),pitch=r.GetMediaItemTakeInfo_Value(take,'D_PITCH'),
      takefx=r.TakeFX_GetCount(take),section=r.GetMediaSourceParent(src)~=nil,chanmode=r.GetMediaItemTakeInfo_Value(take,'I_CHANMODE'),takeptr=take,item=it}
  end
  function H.workshop_catalog(a)
    stopped();audio();local p,path=current();assert(path~='','Enregistre d’abord ton projet REAPER')
    assert(not a.project or a.project==path,'Projet changé')
    local tracks={}
    helpers.each_track(function(tr,index)
      local items={};local channels=1
      for i=0,r.CountTrackMediaItems(tr)-1 do
        local d=item_data(r.GetTrackMediaItem(tr,i))
        if d then channels=math.max(channels,d.channels);d.takeptr=nil;d.item=nil;items[#items+1]=d end
      end
      if #items>0 then tracks[#tracks+1]={index=index,guid=r.GetTrackGUID(tr),name=helpers.track_name(tr),channels=channels,items=items} end
    end)
    return {project=path,tracks=tracks,outputs=r.GetNumAudioOutputs(),device=select(2,r.GetAudioDeviceInfo('IDENT_OUT','')) or '',rate=tonumber(select(2,r.GetAudioDeviceInfo('SRATE',''))) or 0}
  end
  function H.workshop_create(a)
    stopped();local source,sourcepath=current();assert(sourcepath==a.source,'Projet source changé')
    assert(type(a.id)=='string' and a.id:match('^[%x%-]+$'),'Identifiant invalide')
    assert(type(a.start)=='number' and type(a.stop)=='number' and a.start>=0 and a.stop-a.start>=1 and a.stop-a.start<=120,'Passage de 120 secondes maximum')
    assert(#a.mapping>0 and #a.mapping<=16,'Choisis les pistes')
    local copies,occupied,totalItems={},{},0
    for _,m in ipairs(a.mapping) do
      assert(m.channel%1==0 and m.channel>=1 and m.channel<=16 and (m.channels==1 or m.channels==2) and m.channel+m.channels-1<=16,'Canal invalide')
      for c=m.channel,m.channel+m.channels-1 do assert(not occupied[c],'Deux pistes vers le même canal');occupied[c]=true end
      local tr=assert(r.GetTrack(source,m.index),'Piste absente');assert(r.GetTrackGUID(tr)==m.guid,'Piste source changée')
      local items={}
      for i=0,r.CountTrackMediaItems(tr)-1 do
        local d=item_data(r.GetTrackMediaItem(tr,i))
        if d and d.pos<a.stop and d.pos+d.length>a.start then
          -- A copied PCM item has an exact, known timeline; unsupported transforms are not silently lost.
          assert(d.rate==1 and d.pitch==0 and d.takefx==0 and r.GetTakeNumStretchMarkers(d.takeptr)==0,'Retire les effets de prise, le pitch et le time-stretch avant l’atelier')
          assert(not d.section and d.chanmode==0 and d.offset>=0,'Source inversée, section ou mode de canal transformé : consolide cette prise avant l’atelier')
          assert(d.channels==m.channels,'Largeur mono/stéréo modifiée')
          local first=math.max(a.start,d.pos);local last=math.min(a.stop,d.pos+d.length)
          local length,beats=r.GetMediaSourceLength(r.GetMediaItemTake_Source(d.takeptr))
          assert(not beats and d.offset+last-d.pos<=length+.001,'Passage au-delà de la source audio : consolide cette prise avant l’atelier')
          totalItems=totalItems+1;assert(totalItems<=128,'Trop d’éléments dans ce passage : consolide les prises')
          items[#items+1]={file=d.file,pos=first,length=last-first,offset=d.offset+first-d.pos,name=d.take}
        end
      end
      assert(#items>0,'Aucune prise audio dans ce passage : '..helpers.track_name(tr))
      for i=2,#items do assert(items[i].pos>=items[i-1].pos+items[i-1].length-.0001,'Éléments superposés : prépare une prise unique') end
      copies[#copies+1]={name=helpers.track_name(tr),channel=m.channel,channels=m.channels,items=items}
    end
    audio();assert(r.GetNumAudioOutputs()>=16,'REAPER doit exposer les sorties USB de la console (au moins 16)')
    r.Main_OnCommand(40859,0) -- new project tab, source stays untouched
    local p=current()
    -- New-project templates/preferences may add tracks or start playback: clear only the new project.
    assert(p~=source,'REAPER n’a pas créé de projet séparé');r.OnStopButton()
    while r.CountTracks(p)>0 do r.DeleteTrack(r.GetTrack(p,0)) end
    r.SetProjExtState(p,'BandPilot','workshop',a.id)
    r.SetProjExtState(p,'BandPilot','source',sourcepath)
    r.GetSetProjectInfo(p,'PROJECT_SRATE',a.rate,true);r.GetSetProjectInfo(p,'PROJECT_SRATE_USE',1,true)
    for i,c in ipairs(copies) do
      r.InsertTrackAtIndex(i-1,false);local tr=r.GetTrack(p,i-1)
      r.GetSetMediaTrackInfo_String(tr,'P_NAME',c.name,true)
      for k,v in pairs({B_MAINSEND=0,I_RECARM=0,I_RECMON=0,D_VOL=1,D_PAN=0,B_MUTE=1,I_SOLO=0,I_NCHAN=2}) do r.SetMediaTrackInfo_Value(tr,k,v) end
      local send=r.CreateTrackSend(tr,nil);assert(send>=0,'Sortie USB indisponible')
      r.SetTrackSendInfo_Value(tr,1,send,'I_SRCCHAN',c.channels==1 and 1024 or 0)
      r.SetTrackSendInfo_Value(tr,1,send,'I_DSTCHAN',c.channel-1+(c.channels==1 and 1024 or 0))
      r.SetTrackSendInfo_Value(tr,1,send,'D_VOL',1);r.SetTrackSendInfo_Value(tr,1,send,'D_PAN',0)
      for _,d in ipairs(c.items) do
        local item=r.AddMediaItemToTrack(tr);local take=r.AddTakeToMediaItem(item)
        r.SetMediaItemTake_Source(take,assert(r.PCM_Source_CreateFromFile(d.file),'Fichier audio introuvable'))
        r.SetMediaItemInfo_Value(item,'D_POSITION',d.pos);r.SetMediaItemInfo_Value(item,'D_LENGTH',d.length)
        r.SetMediaItemInfo_Value(item,'B_LOOPSRC',0);r.SetMediaItemInfo_Value(item,'D_VOL',1)
        r.SetMediaItemInfo_Value(item,'D_FADEINLEN',0);r.SetMediaItemInfo_Value(item,'D_FADEOUTLEN',0)
        r.SetMediaItemTakeInfo_Value(take,'D_STARTOFFS',d.offset);r.SetMediaItemTakeInfo_Value(take,'D_VOL',1)
        r.GetSetMediaItemTakeInfo_String(take,'P_NAME',d.name,true)
      end
    end
    r.GetSet_LoopTimeRange(true,true,a.start,a.stop,false);r.GetSetRepeat(1);r.SetEditCurPos(a.start,false,false)
    r.Main_SaveProjectEx(p,a.file,8);r.UpdateArrange()
    local _,path=current();assert(path==a.file,'Projet atelier non enregistré')
    return {project=path,source=sourcepath,tracks=#copies}
  end
  function H.workshop_transport(a)
    local p=checked(a)
    if a.action=='play' then
      audio()
      assert(r.GetNumAudioOutputs()>=16,'Sorties USB indisponibles')
      helpers.each_track(function(tr)r.SetMediaTrackInfo_Value(tr,'B_MUTE',0);r.SetMediaTrackInfo_Value(tr,'I_RECARM',0)end)
      r.SetEditCurPos(a.start,false,false);r.OnPlayButton()
    else r.OnStopButton() end
    return H.transport()
  end
  function H.workshop_leave(a)
    local p=checked(a);r.OnStopButton()
    helpers.each_track(function(tr)r.SetMediaTrackInfo_Value(tr,'B_MUTE',1)end)
    r.Main_SaveProjectEx(p,a.project,8)
    for i=0,100 do local other,path=r.EnumProjects(i,'');if not other then break end;if path==a.source then r.SelectProjectInstance(other);break end end
    return {stopped=true}
  end
  -- Bounded one-second reads run between transport commands, never in the audio callback.
  function H.workshop_revision(a) local p=checked(a);stopped();return {revision=r.GetProjectStateChangeCount(p)} end
  function H.workshop_measure(a)
    local p=checked(a);stopped();assert(r.GetProjectStateChangeCount(p)==a.revision,'Projet modifié pendant la mesure : relance l’analyse')
    assert(type(a.start)=='number' and a.start>=0 and type(a.duration)=='number' and a.duration>0 and a.duration<=1,'Fenêtre de mesure invalide')
    local tr=assert(r.GetTrack(0,a.track),'Piste atelier introuvable')
    audio();local rate=tonumber(select(2,r.GetAudioDeviceInfo('SRATE',''))) or 0
    assert(rate>=32000 and rate<=192000,'Fréquence audio indisponible')
    local accessor=assert(r.CreateTrackAudioAccessor(tr),'Audio inaccessible')
    local ok,result=pcall(function()
      local frames=math.floor(rate*a.duration);local peak,sum,count,clipped=0,0,0,0
      for offset=0,frames-1,2048 do
        local n=math.min(2048,frames-offset);local buffer=r.new_array(n*2)
        local got=r.GetAudioAccessorSamples(accessor,rate,2,a.start+offset/rate,n,buffer)
        assert(got>=0,'Échantillons audio illisibles')
        count=count+n*2 -- Include silent gaps in the RMS denominator for the whole passage.
        if got>0 then for _,v in ipairs(buffer.table()) do local x=math.abs(v);peak=math.max(peak,x);sum=sum+v*v;if x>=.999 then clipped=clipped+1 end end end
      end
      return {start=a.start,duration=a.duration,peak=peak,sumSquares=sum,samples=count,clipped=clipped,rate=rate}
    end)
    r.DestroyAudioAccessor(accessor);assert(ok,result);return result
  end
end
