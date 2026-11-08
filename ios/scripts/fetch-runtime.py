#!/usr/bin/env python3
"""Fetch the pinned upstream iOS framework; never store binaries in Git."""
import hashlib, pathlib, tempfile, urllib.request, zipfile, shutil
target=pathlib.Path(__file__).resolve().parents[1]/'vendor'
url='https://github.com/nodejs-mobile/nodejs-mobile/releases/download/v18.20.4/nodejs-mobile-v18.20.4-ios.zip'
checksum='8c5ca3a0d1e38de7f182a5642593e82593b820efd375a14b3ecafc4bcfee620e'
with tempfile.TemporaryDirectory(prefix='bandpilot-ios-') as temporary:
 archive=pathlib.Path(temporary)/'runtime.zip'
 urllib.request.urlretrieve(url,archive)
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=checksum:raise SystemExit('Runtime checksum mismatch')
 unpack=pathlib.Path(temporary)/'unpacked'
 with zipfile.ZipFile(archive) as z:
  for name in z.namelist():
   if pathlib.PurePosixPath(name).is_absolute() or '..' in pathlib.PurePosixPath(name).parts:raise SystemExit('Unsafe archive path')
  z.extractall(unpack)
 framework=unpack/'NodeMobile.xcframework'
 for abi in ['ios-arm64','ios-arm64_x86_64-simulator']:
  if not (framework/abi/'NodeMobile.framework'/'NodeMobile').is_file():raise SystemExit('Missing framework slice: '+abi)
 target.mkdir(parents=True,exist_ok=True)
 destination=target/'NodeMobile.xcframework'
 if destination.exists():shutil.rmtree(destination)
 shutil.copytree(framework,destination)
print('Verified NodeMobile 18.20.4: iPad ARM64 and ARM64/x86_64 simulators')
