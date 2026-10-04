import { randomBytes } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
const path = '.env.local-stack';
const secret = () => randomBytes(32).toString('hex');
const defaults = { NODE_ENV: 'development', APP_URL: 'http://localhost:8080', SITE_ADDRESS: ':80' };
for (const key of ['POSTGRES_PASSWORD','APP_DB_PASSWORD','AUTH_DB_PASSWORD','WORKER_DB_PASSWORD','CMS_DB_PASSWORD','VALKEY_PASSWORD','BETTER_AUTH_SECRET','PAYLOAD_SECRET']) defaults[key] = secret();
let existing = '';
try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const keys = new Set(existing.split(/\r?\n/).filter(line => !line.startsWith('#')).map(line => line.split('=')[0]));
const missing = Object.entries(defaults).filter(([key]) => !keys.has(key)).map(([key,value]) => `${key}=${value}`).join('\n');
if (!existing) await writeFile(path, `# Local development only. Generated secrets; do not commit.\n${missing}\n`, { flag: 'wx', mode: 0o600 });
else if (missing) await appendFile(path, `\n# Newly required local services\n${missing}\n`);
console.log('Local configuration ready. Existing values preserved; secrets were not printed.');
