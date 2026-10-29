// Heuristic pre-publish scan; reports locations only, never secret values.
const fs=require('fs'),{execFileSync}=require('child_process');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],['cloud-key',/\bAKIA[A-Z0-9]{16}\b/],['provider-token',/\bsk-[A-Za-z0-9_-]{32,}\b/],['literal-secret',/(?:api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_+\/-]{20,}["']/i]];
const hits=[];for(const file of files){if(file=== 'scripts/scan-secrets.cjs')continue;const stat=fs.statSync(file);if(stat.size>6000000)continue;const b=fs.readFileSync(file);if(b.includes(0))continue;const text=b.toString('utf8');for(const [kind,re]of patterns)if(re.test(text))hits.push({file,kind});}
console.log(JSON.stringify({trackedFiles:files.length,findings:hits,scope:'Heuristic patterns only; not a complete security or data audit'},null,2));if(hits.length)process.exitCode=1;
