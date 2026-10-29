
'use strict';
const {spawn}=require('child_process'),path=require('path');
function validate(q){
 if(!q||!['taiyi','liuren','qimen'].includes(q.kind))throw Error('未知算法');
 const keys=['year','month','day','hour','minute'];
 for(const k of keys)if(!Number.isInteger(q[k]))throw Error('日期需要整数');
 if(q.year<1900||q.year>2100||q.month<1||q.month>12||q.day<1||q.day>31||q.hour<0||q.hour>23||q.minute<0||q.minute>59)throw Error('日期超出范围');
 const test=new Date(Date.UTC(q.year,q.month-1,q.day));if(test.getUTCMonth()!==q.month-1)throw Error('日期无效');
 const method=q.method??0,style=q.style??3;
 if(!Number.isInteger(method)||method<0||method>3||!Number.isInteger(style)||style<0||style>4)throw Error('排法无效');
 return Object.fromEntries(['kind',...keys,'method','style'].map(k=>[k,k==='method'?method:k==='style'?style:q[k]]));
}
let active=0;
function run(q,base){q=validate(q);if(active>=2)return Promise.reject(Error('已有演算进行中，请稍后'));active++;
 return new Promise((resolve,reject)=>{
 const proc=spawn(path.join(base,'python','python.exe'),['-I',path.join(base,'runner.py')],{cwd:base,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',settled=false;
 const finish=(err,data)=>{if(settled)return;settled=true;clearTimeout(timer);active--;err?reject(err):resolve(data)};
 const timer=setTimeout(()=>{proc.kill();finish(Error('本地算法计算超时'))},25000);
 proc.stdout.on('data',b=>{stdout+=b.toString('utf8');if(stdout.length>1500000){proc.kill();finish(Error('结果过大'))}});
 proc.stderr.on('data',b=>{stderr+=b.toString('utf8')});
 proc.on('error',e=>finish(Error('算法运行时未能启动：'+e.message)));
 proc.on('close',()=>{if(settled)return;try{const parsed=JSON.parse(stdout);if(!parsed.ok)throw Error(parsed.error||'计算失败');finish(null,parsed.result)}catch(e){finish(Error('计算未完成：'+e.message+(stderr?'；'+stderr.slice(-300):'')))}});
 proc.stdin.end(JSON.stringify(q));
 });
}
module.exports={run,validate};
