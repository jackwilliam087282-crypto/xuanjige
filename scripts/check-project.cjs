const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');let checked=0;const errors=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist','.git','engine','vendor','.build-tools'].includes(e.name)||e.name.startsWith('dist-'))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|cjs)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});checked++;if(r.status)errors.push(path.relative(root,p)+': '+r.stderr)}}}
walk(root);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)){const uri=match[1];if(/^(?:[a-z]+:|#|\/\/)/i.test(uri)||uri.includes('${'))continue;const clean=uri.split(/[?#]/)[0];if(clean&&!fs.existsSync(path.join(root,clean)))errors.push('Missing local resource: '+clean)}
for(const p of ['main.js','preload.js','bazi-core.js','engine/runner.py','engine/python/python.exe','engine/python/python311.zip','LICENSE','vendor/lunar-LICENSE'])if(!fs.existsSync(path.join(root,p)))errors.push('Missing required file: '+p);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(`Project check passed: ${checked} JavaScript files and local HTML resources`);
