-- FFT evidence from REAPER's native FFT. No audio or spectra leave the local bridge.
return function(r)
  local hz={31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000}
  local size=8192;local hann={};for i=1,size do hann[i]=.5-.5*math.cos(2*math.pi*(i-1)/(size-1)) end
  return function(samples,n,channels,rate)
    local bands={};for i=1,#hz do bands[i]=0 end
    for ch=1,channels do
      local fft=r.new_array(size)
      for i=1,size do fft[i]=(i<=n and samples[(i-1)*channels+ch] or 0)*hann[i] end
      fft.fft_real(size,true)
      local bins=fft.table()
      for b,f in ipairs(hz) do
        local first,last=math.max(1,math.ceil(f/2^(1/6)*size/rate)),math.min(size/2-1,math.floor(f*2^(1/6)*size/rate))
        for k=first,last do local re,im=bins[2*k+1],bins[2*k+2];bands[b]=bands[b]+(re*re+im*im)/(size*size*channels) end
      end
    end
    return bands
  end
end
