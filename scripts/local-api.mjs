import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const local=Object.fromEntries((await readFile('.env.local-stack','utf8')).split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const environment={...process.env,NODE_ENV:'development',APP_URL:'http://localhost:4000',HOST:'127.0.0.1',PORT:'4000',BETTER_AUTH_SECRET:local.BETTER_AUTH_SECRET,DATABASE_URL:`postgresql://olaph_login:${local.APP_DB_PASSWORD}@127.0.0.1:54320/olaph`,AUTH_DATABASE_URL:`postgresql://olaph_auth:${local.AUTH_DB_PASSWORD}@127.0.0.1:54320/olaph`,SMTP_HOST:'127.0.0.1',SMTP_PORT:'1025',MAIL_FROM:'OLAPH <noreply@localhost>',CLAMAV_HOST:'127.0.0.1',STATIC_WEB_DIR:'../web/out'};
const command=process.argv[2]==='migrate'?'migrate':'main';
if(command==='migrate')environment.MIGRATION_DATABASE_URL=`postgresql://olaph_owner:${local.POSTGRES_PASSWORD}@127.0.0.1:54320/olaph`;
const child=spawn(process.execPath,[`dist/${command}.js`],{cwd:'apps/api',env:environment,stdio:'inherit'});child.on('exit',code=>process.exitCode=code||0);
