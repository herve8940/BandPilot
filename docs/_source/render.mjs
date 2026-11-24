// Run with Node.js from any directory. GitHub Pages serves the generated HTML directly.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const check = process.argv[2] === '--check';
if (process.argv.length > (check ? 3 : 2)) throw Error('Usage: node docs/_source/render.mjs [--check]');
const site = 'https://herve8940.github.io/BandPilot/';
const repo = 'https://github.com/herve8940/BandPilot';
const desktop = '3.0.1';
const android = '2.4.0-android.5';
const desktopRelease = `${repo}/releases/tag/v${desktop}`;
const androidRelease = `${repo}/releases/tag/android-v${android}`;
const androidFile = `${repo}/releases/download/android-v${android}/BandPilot-Android-${android}-universal.apk`;
const downloadBase = `${repo}/releases/download/v${desktop}/BandPilot-`;
const systems = [
  ['Windows', [['Windows (.exe)', `Windows-${desktop}.exe`]]],
  ['macOS', [['Apple Silicon', `macOS-${desktop}-arm64.dmg`], ['Intel', `macOS-${desktop}-x64.dmg`]]],
  ['Linux', [['AppImage', `Linux-${desktop}-x86_64.AppImage`], ['Debian / Ubuntu', `Linux-${desktop}-amd64.deb`]]],
];
const langs = ['fr', 'en', 'de', 'es', 'it'];
const models = ['Behringer XR18 / X18 · Midas MR18', 'Behringer XR12 · Midas MR12', 'Behringer X32 · Rack · Compact · Producer · Core'];
const views = [['balance', 'balance'], ['monitors', 'monitors'], ['show', 'show'], ['mixer', 'hero']];
const photos = 'images/bandpilot-3.0/';
const language = Object.fromEntries(langs.map(l => [l, JSON.parse(read(`docs/_source/${l}.json`))]));
const file = l => l === 'fr' ? 'index.html' : `${l}.html`;
const readme = l => l === 'fr' ? 'README.md' : `README.${l}.md`;
const canonical = l => site + (l === 'fr' ? '' : file(l));
const esc = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const link = (url, label, attrs = '') => `<a href="${esc(url)}"${attrs}>${esc(label)}</a>`;
const md = (label, url) => `[${label}](${url})`;
const chain = links => links.join(' · ');
const coach = l => 'TUTO_MON_INGE_SON' + (l === 'fr' ? '' : '_' + l.toUpperCase());
const languageLinks = l => langs.map(code => link(file(code), code.toUpperCase(), ` lang="${code}" hreflang="${code}" aria-label="${language[code].language}" title="${language[code].language}"${code === l ? ' aria-current="page"' : ''}`)).join('\n');
const photoCredit = 'https://unsplash.com/photos/a-person-is-operating-a-sound-mixing-console-UG9LOi8BJWQ';

// The two project-wide sync scripts own these marked blocks, including invitation and donation URLs.
function synced(path, key) {
  const block = read(path).match(new RegExp(`<!-- ${key}:start -->[\\s\\S]*?<!-- ${key}:end -->`));
  if (!block) throw Error(`Missing ${key} block in ${path}`);
  return block[0];
}
function write(path, body) {
  if (read(path) === body) return;
  if (check) { console.error(`Out of date: ${path}`); process.exitCode = 1; }
  else writeFileSync(new URL(path, root), body);
}

function home(l, t) {
  const f = 'docs/' + file(l), guide = 'USER_GUIDE_' + l.toUpperCase() + '.html';
  const notes = 'RELEASE_NOTES.html#release-' + l;
  const title = 'BandPilot · ' + t.heading.join(' ');
  const tabs = views.map(([id], i) => link('#view-' + id, t.tabs[i], ' data-view')).join('\n');
  const panels = views.map(([id, img], i) => `<article id="view-${id}" class="panel">
    <figure><a class="screenshot-link" href="${photos}${img}.jpg" aria-label="${esc(t.zoom + ' · ' + t.tabs[i])}"><img src="${photos}${img}.jpg" width="1600" height="879" loading="lazy" alt="${esc(t.alt[i] + ' · ' + t.sim)}"></a><figcaption>${esc(t.sim)}</figcaption></figure>
    <div class="panel-copy"><h3>${esc(t.viewTitles[i])}</h3><p>${esc(t.viewTexts[i])}</p>${link(i === 0 ? coach(l) + '.html' : guide, i === 0 ? t.coach : t.guide)}</div>
  </article>`).join('\n');
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(t.intro)}">
<meta name="theme-color" content="#111019">
<link rel="canonical" href="${canonical(l)}">
${langs.map(code => `<link rel="alternate" hreflang="${code}" href="${canonical(code)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${site}">
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'BandPilot',applicationCategory:'MultimediaApplication',operatingSystem:'Windows, macOS, Linux',softwareVersion:desktop,inLanguage:l,description:t.intro,url:canonical(l),downloadUrl:desktopRelease,offers:{'@type':'Offer',price:'0',priceCurrency:'EUR'}}).replaceAll('<','\\u003c')}</script>
<meta property="og:type" content="website"><meta property="og:site_name" content="BandPilot"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(t.intro)}"><meta property="og:url" content="${canonical(l)}"><meta property="og:image" content="${site}${photos}hero.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="sitemap" type="application/xml" href="${site}sitemap.xml"><link rel="icon" type="image/png" href="assets/bandpilot.png">
<link rel="stylesheet" href="assets/bandpilot.css"><script src="assets/gallery.js" defer></script><script src="assets/screenshots.js" defer></script>
</head>
<body>
${link('#main', t.skip, ' class="skip"')}
<header class="mast"><div class="wrap mast-inner">
<a class="brand" href="${file(l)}"><img width="38" height="38" src="assets/bandpilot.png" alt="">BandPilot</a>
<nav class="primary-nav" aria-label="BandPilot">${link('#features', t.navMix)}${link('#models', t.models)}${link('#tutorials', t.guide)}${link('#download',t.downloads)}</nav>
<nav id="languages" class="langs" aria-label="${esc(t.langLabel)}">${languageLinks(l)}</nav></div></header>
<main id="main">
<section class="hero" aria-labelledby="headline"><img class="stage" src="${photos}stage.jpg" width="1800" height="1200" alt="" fetchpriority="high">
<div class="wrap hero-inner"><div class="hero-copy"><p class="edition"><span>BandPilot ${desktop}</span> ${esc(t.platform)}</p>
<h1 id="headline">${esc(t.heading[0])}<em>${esc(t.heading[1])}</em></h1><p class="intro">${esc(t.intro)}</p>
<div class="actions">${link('#download',t.get,' class="button accent"')}${link(guide,t.guide,' class="button ghost"')}</div>
</div></div></section>
<section class="section feature" id="features"><div class="wrap"><div class="section-head"><div><p class="kicker">${esc(t.views)}</p><h2 id="workspace">${esc(t.explore)}</h2></div></div>
<div id="screenshots" class="gallery"><nav class="view-links" aria-label="${esc(t.views)}">${tabs}</nav>${panels}</div>
<div class="release-line" id="scenes-presets"><a id="news" href="${notes}">BandPilot ${desktop} · ${esc(t.release)}</a></div></div></section>
<section class="section gear" id="models"><div class="wrap split"><div><p class="kicker">${esc(t.hardware)}</p><h2>${esc(t.modelTitle)}</h2>${link('multi-model.html',t.matrix)}</div>
<div class="model-list">${models.map((name,i)=>`<article><h3>${esc(name)}</h3><p>${esc(t.modelTexts[i])}</p></article>`).join('\n')}</div></div></section>
<section class="section install" id="download"><div class="wrap"><div class="section-head"><div><p class="kicker">${esc(t.desktop)} · ${desktop}</p><h2>${esc(t.installTitle)}</h2></div>${link(desktopRelease,t.allFiles)}</div>
<div class="platforms">${systems.map(([os, files])=>`<article><h3>${os}</h3><div class="files">${files.map(([label,name])=>link(downloadBase + name,label)).join('')}</div></article>`).join('\n')}</div>
<article class="android" id="android"><div><h3>${esc(t.android)}</h3><p>${esc(t.androidText)}</p></div><div class="files">${link(androidFile,t.apk,' class="button"')}${link(androidRelease,t.androidNotes+' · '+android)}${link('ANDROID.html',t.androidGuide)}</div></article></div></section>
<section class="section start" id="tutorials"><div class="wrap split"><div><h2>${esc(t.startTitle)}</h2><p>${esc(t.reaper)}</p>${link(guide,t.guide,' class="button dark"')}</div>
<div><ol class="steps">${t.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="resource-links">${link(coach(l)+'.html',t.coach)}${link(guide+'#rider',t.rider)}${link(guide+'#reaper',t.rehearse)}${link('VIDEO_TOUR.html',t.video,' id="video"')}</div></div></div></section>
<div class="community-strip"><div class="wrap community-pair">
${synced(f,'community')}
${synced(f,'support')}
</div></div>
</main>
<footer class="foot"><div class="wrap"><div class="foot-row"><a class="brand" href="${file(l)}"><img src="assets/bandpilot.png" alt="" width="32" height="32">BandPilot</a><nav aria-label="BandPilot · GitHub">${link(repo,t.source)}${link(repo+'/issues/new/choose',t.issue)}${link('PRIVACY.html',t.privacy+' (FR / EN)')}${link(repo+'/blob/main/LICENSE',t.license)}</nav></div>
<small>${esc(t.photo)} · ${link(photoCredit,'Rob Wingate / Unsplash')} · ${link('https://unsplash.com/license','Unsplash License')}</small></div></footer>
<dialog class="screenshot-viewer" aria-label="${esc(t.zoom)}"><header><p></p><button type="button" autofocus>${esc(t.close)} ×</button></header><img alt=""></dialog>
</body></html>
`;
}

function repoHome(l, t) {
  const f = readme(l), guide = 'docs/USER_GUIDE_' + l.toUpperCase() + '.md';
  return `# BandPilot

${chain(langs.map(code => code === l ? '**'+language[code].language+'**' : md(language[code].language,readme(code))))}

**${t.heading.join(' ')}** ${t.intro}

${chain([md(t.get,canonical(l)+'#download'),md(t.guide,guide),md(t.release,'docs/RELEASE_NOTES.md#release-'+l)])}

[![${t.tabs[3]} · ${t.sim}](docs/${photos}hero.jpg)](${canonical(l)}#view-mixer)

## ${t.installTitle}

| ${t.desktop} ${desktop} | ${t.downloads} |
| --- | --- |
${systems.map(([os,files]) => '| '+os+' | '+chain(files.map(([label,name])=>md(label,downloadBase+name)))+' |').join('\n')}

${md(t.allFiles,desktopRelease)}

**${t.android}.** ${t.androidText} ${md(t.apk+' · '+android,androidFile)}

## ${t.startTitle}

${t.steps.map((s,i)=>(i+1)+'. '+s).join('\n')}

${t.viewTexts[0]} ${t.viewTexts[1]}

${t.viewTexts[2]} ${t.reaper}

${chain([md(t.coach,'docs/'+coach(l)+'.md'),md(t.website,canonical(l))])}

## ${t.models}

${models.map((name,i) => '- **'+name+'** — '+t.modelTexts[i]).join('\n')}

${md(t.matrix,'docs/multi-model.md')}

## ${t.readLocal}

${t.dev}

\`\`\`sh
npm run ci:deps
npm --prefix web ci
npm run studio
\`\`\`

${chain([md(t.contrib,'CONTRIBUTING.md'),md(t.issue,repo+'/issues/new/choose'),md(t.license,'LICENSE')])}

${synced(f,'community')}

${synced(f,'community-badge')}

${synced(f,'support')}
`;
}
for (const code of langs) {
  write('docs/'+file(code), home(code,language[code]));
  write(readme(code), repoHome(code,language[code]));
}
