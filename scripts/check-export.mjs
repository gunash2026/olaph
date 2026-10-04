import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('apps/web/out');
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const pages=(await files(root)).filter(f=>f.endsWith('.html'));
const problems=[];
for(const file of pages){const html=await readFile(file,'utf8');const relative=path.relative(root,file).replaceAll('\\','/');const headings=[...html.matchAll(/<h1(?:\s|>)/g)];if(/^(tr|en|ar|zh|ru)\//.test(relative)&&headings.length!==1)problems.push(`${relative}: expected 1 h1, found ${headings.length}`);for(const [,raw] of html.matchAll(/(?:href|src)="([^"#]+)"/g)){if(!raw.startsWith('/'))continue;let url=raw.split(/[?#]/)[0];if(base&&url.startsWith(base+'/'))url=url.slice(base.length);const target=path.resolve(root,'.'+decodeURIComponent(url));if(target!==root&&!target.startsWith(root+path.sep)){problems.push(`${relative}: invalid path`);continue;}try{const info=await stat(target);if(info.isDirectory())await stat(path.join(target,'index.html'));}catch{problems.push(`${relative}: missing ${url}`);}}}
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exit(1);}
console.log(`${pages.length} HTML pages: local links, assets and primary headings verified.`);
