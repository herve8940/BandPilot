const {execFileSync}=require('node:child_process');
const {writeFileSync}=require('node:fs');
let commit=process.env.GITHUB_SHA;
try{commit??=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{commit='source';}
const version=require('../package.json').version;
writeFileSync(require('node:path').join(__dirname,'../desktop/build-info.json'),JSON.stringify({version,commit,builtAt:new Date().toISOString()}));
