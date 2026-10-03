import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const secret=()=>randomBytes(32).toString('hex');
const content=`# Local development only. Generated secrets; do not commit.\nNODE_ENV=development\nAPP_URL=http://localhost:8080\nSITE_ADDRESS=:80\nPOSTGRES_PASSWORD=${secret()}\nAPP_DB_PASSWORD=${secret()}\nAUTH_DB_PASSWORD=${secret()}\nBETTER_AUTH_SECRET=${secret()}\n`;
try{await writeFile('.env.local-stack',content,{flag:'wx',mode:0o600});console.log('Created .env.local-stack. Secrets were not printed.')}catch(error){if(error.code==='EEXIST')console.log('Existing .env.local-stack preserved.');else throw error}
