// Backport the bounded UserProgramFiles copy from electron-builder #9769.
// https://github.com/electron-userland/electron-builder/commit/a356198ec7c54c7795659342bff36d9a5162cd93
// The old fixed-size pointer read can crash System.dll on a fresh Windows install.
const {readFileSync,writeFileSync}=require('node:fs');
const {join,dirname}=require('node:path');
function patchTemplate(text){
 if(text.includes('KERNEL32::lstrcpynW(w .r0, p r2, i ${NSIS_MAX_STRLEN})p'))return text;
 const start=text.indexOf('      System::Store S');
 const finish=text.indexOf('      System::Store L',start);
 if(start<0||finish<0||!text.slice(start,finish).includes("System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'"))throw Error('Modèle NSIS inattendu : vérifier le correctif du chemin avant de publier.');
 const replacement=[
  '      Push $1',
  '      Push $2',
  '      StrCpy $2 0',
  '      System::Call \'SHELL32::SHGetKnownFolderPath(g "${FOLDERID_UserProgramFiles}", i ${KF_FLAG_CREATE}, p 0, *p .r2)i.r1\'',
  '      ${If} $1 == 0',
  '        System::Call \'KERNEL32::lstrcpynW(w .r0, p r2, i ${NSIS_MAX_STRLEN})p\'',
  '      ${endif}',
  '      ${If} $2 != 0',
  '        System::Call \'OLE32::CoTaskMemFree(p r2)\'',
  '      ${endif}',
  '      Pop $2',
  '      Pop $1'
 ].join('\n');
 return text.slice(0,start)+replacement+text.slice(finish+'      System::Store L'.length);
}
if(require.main===module&&process.platform==='win32'){
 const file=join(dirname(require.resolve('app-builder-lib/package.json')),'templates/nsis/multiUser.nsh');
 const before=readFileSync(file,'utf8').replace(/\r\n/g,'\n'),after=patchTemplate(before);
 if(after!==before)writeFileSync(file,after);
 console.log('NSIS : copie bornée du chemin utilisateur vérifiée.');
}
module.exports={patchTemplate};
