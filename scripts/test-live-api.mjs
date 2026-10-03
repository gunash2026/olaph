// Runs only against an explicitly configured disposable local/CI environment.
import assert from 'node:assert/strict';
import { randomUUID,createHmac } from 'node:crypto';
const origin=process.env.TEST_APP_URL||'http://127.0.0.1:4000',mail=process.env.TEST_MAIL_URL||'http://127.0.0.1:8025';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('This test creates records and is restricted to a local disposable environment.');
const password='Test-only-account-password-2026!';
function client(){const cookies=new Map();return async(path,body,expected=200)=>{
 const response=await fetch(`${origin}${path}`,{method:body?'POST':'GET',redirect:'manual',headers:{origin,'content-type':'application/json',cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined});
 for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={}}
 assert.equal(response.status,expected,`${path}: HTTP ${response.status}, ${data.message||data.code||'unexpected response'}`);return data;
}}
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replaceAll('=',''))bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from((bits.match(/.{8}/g)||[]).map(x=>parseInt(x,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',key).update(counter).digest();const at=hash[19]&15;return String((hash.readUInt32BE(at)&0x7fffffff)%1000000).padStart(6,'0')}
async function account(name){const request=client(),email=`${name}-${randomUUID()}@example.test`;
 await request('/api/auth/sign-up/email',{name,email,password,callbackURL:`${origin}/tr/portal/`});
 let message;for(let i=0;i<20;i++){const inbox=await(await fetch(`${mail}/api/v1/messages`)).json();message=inbox.messages?.find(item=>item.To?.some(to=>to.Address===email));if(message)break;await new Promise(resolve=>setTimeout(resolve,500))}
 assert.ok(message,'Verification email must arrive in the local Mailpit inbox');
 const content=await(await fetch(`${mail}/api/v1/message/${message.ID}`)).json(),url=content.Text.match(/https?:\/\/[^\s]+/)[0];
 assert.equal(new URL(url).origin,origin);await request(new URL(url).pathname+new URL(url).search,undefined,302);
 await request('/api/auth/sign-in/email',{email,password});return request;
}
const alice=await account('alice');
assert.deepEqual((await alice('/api/session')).workspaces,[]);
const workspace=await alice('/api/workspaces',{name:'Integration test A'},201),tenant=workspace.id;
await alice(`/api/workspaces/${tenant}/resources/materials`,undefined,423);
const enrollment=await alice('/api/auth/two-factor/enable',{password});
const secret=new URL(enrollment.totpURI).searchParams.get('secret');assert.ok(secret);
await alice('/api/auth/two-factor/verify-totp',{code:totp(secret),trustDevice:false});
const material=await alice(`/api/workspaces/${tenant}/resources/materials`,{code:'MAT-A',name:'Test material',unit:'unit',minimum:'2'},201);
const warehouse=await alice(`/api/workspaces/${tenant}/resources/warehouses`,{name:'Main'},201);
const movement={material_id:material.id,warehouse_id:warehouse.id,direction:'in',quantity:'10.125',note:'Test receipt',idempotency_key:randomUUID()};
await alice(`/api/workspaces/${tenant}/movements`,movement,201);await alice(`/api/workspaces/${tenant}/movements`,movement,201);
assert.equal((await alice(`/api/workspaces/${tenant}/resources/materials`)).items[0].quantity,'10.125000');
await alice(`/api/workspaces/${tenant}/movements`,{...movement,direction:'out',quantity:'11',idempotency_key:randomUUID()},409);
const recipient=`notifications-${randomUUID()}@example.test`;
await alice(`/api/workspaces/${tenant}/resources/notification-rules`,{event:'purchase_pending',channel:'email',recipient,enabled:true},201);
const purchase=await alice(`/api/workspaces/${tenant}/resources/purchases`,{material_id:material.id,quantity:'1',unit_price:'5',currency:'USD'},201);
let notification;
for(let attempt=0;attempt<40;attempt++){
 const inbox=await(await fetch(`${mail}/api/v1/messages`)).json();notification=inbox.messages?.find(item=>item.To?.some(to=>to.Address===recipient));
 if(notification)break;await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(notification,'The committed purchase event must reach Mailpit through the restricted outbox worker and Valkey');
await alice(`/api/workspaces/${tenant}/purchases/${purchase.id}/decision`,{decision:'approved'},428);
await alice('/api/reauthenticate',{password,code:totp(secret)},201);
await alice(`/api/workspaces/${tenant}/purchases/${purchase.id}/decision`,{decision:'approved'},201);
assert.equal((await alice(`/api/workspaces/${tenant}/resources/purchases`)).items[0].status,'approved');
for(let attempt=0;attempt<5;attempt++)await alice('/api/reauthenticate',{password:'incorrect-password',code:totp(secret)},401);
await alice('/api/reauthenticate',{password,code:totp(secret)},429);
const bob=await account('bob');await bob(`/api/workspaces/${tenant}/resources/materials`,undefined,403);
await client()(`/api/workspaces/${tenant}/resources/materials`,undefined,401);
console.log('PASS: email verification, sessions, MFA enforcement, empty onboarding, tenant isolation, exact/idempotent inventory, negative-stock rejection, outbox/Valkey/SMTP delivery, recent-auth approval and account lock after five failed confirmations.');
