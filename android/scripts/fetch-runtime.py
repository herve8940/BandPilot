#!/usr/bin/env python3
"""Download the pinned upstream Android runtime. No binaries are committed."""
import hashlib, pathlib, tempfile, urllib.request, zipfile, shutil
target = pathlib.Path(__file__).resolve().parents[1] / 'app' / 'libnode'
url = 'https://github.com/nodejs-mobile/nodejs-mobile/releases/download/v18.20.4/nodejs-mobile-v18.20.4-android.zip'
checksum = 'bd7321eaa1a7602fbe0bb87302df2d79d87835cf4363fbdd17c350dbb485c2af'
with tempfile.TemporaryDirectory(prefix='bandpilot-runtime-') as temporary:
 archive=pathlib.Path(temporary)/'runtime.zip'
 urllib.request.urlretrieve(url,archive)
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=checksum: raise SystemExit('Runtime checksum mismatch')
 unpack=pathlib.Path(temporary)/'unpacked'
 with zipfile.ZipFile(archive) as z:
  for name in z.namelist():
   if pathlib.PurePosixPath(name).is_absolute() or '..' in pathlib.PurePosixPath(name).parts: raise SystemExit('Unsafe archive path')
  z.extractall(unpack)
 for abi in ['arm64-v8a','armeabi-v7a','x86_64']:
  if not (unpack/'bin'/abi/'libnode.so').is_file(): raise SystemExit('Missing runtime ABI: '+abi)
 if target.exists():shutil.rmtree(target)
 shutil.copytree(unpack,target)
print('Verified nodejs-mobile 18.20.4: ARM64, ARM32 and x86_64')
