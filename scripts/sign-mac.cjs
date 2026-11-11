// The public builds currently have no Developer ID certificate. Seal every
// nested binary with an ad-hoc signature, then verify the complete bundle.
// This is integrity checking, not Apple notarization or a Gatekeeper override.
const {signAsync}=require('@electron/osx-sign');
const {execFileSync}=require('node:child_process');
module.exports=async options=>{
 await signAsync({...options,identity:'-',identityValidation:false,preAutoEntitlements:false,preEmbedProvisioningProfile:false,
  optionsForFile:file=>({...options.optionsForFile(file),timestamp:'none'})});
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',options.app],{stdio:'inherit'});
};
