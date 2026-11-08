#!/usr/bin/env python3
"""Fail if an apparently successful APK omitted the native engine or web assets."""
import pathlib,sys,zipfile,hashlib,struct
path=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(path) as apk:
 names=set(apk.namelist())
 for abi,machine in [('armeabi-v7a',40),('arm64-v8a',183),('x86_64',62)]:
  for library in ['libnode.so','libbandpilot.so','libc++_shared.so']:
   name=f'lib/{abi}/{library}'
   assert name in names,f'Missing native library: {name}'
   data=apk.read(name)
   assert data[:4]==b'\x7fELF' and struct.unpack_from('<H',data,18)[0]==machine,f'Wrong ABI: {name}'
 for name in ['bootstrap.cjs','server.mjs','version.json','web/index.html','node_modules/sql.js/dist/sql-wasm.wasm','licenses/nodejs-mobile.txt','licenses/BandPilot.txt','licenses/THIRD_PARTY_NOTICES.txt']:
  assert 'assets/runtime/'+name in names,f'Missing runtime asset: {name}'
 assert not any(n.endswith(('.jks','.keystore','signing.properties')) for n in names),'Signing material in APK'
print('APK verified: 3 ABIs, native engine, SQLite and embedded UI')
print(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+path.name)
