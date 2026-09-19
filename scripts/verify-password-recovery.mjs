import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Requires the local app on port 3000 connected to this local Supabase project.
const status=JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(status.MAILPIT_URL).hostname));
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,opts);
const login=createClient(status.API_URL,status.ANON_KEY,opts);
const mailbox=`recovery-${randomUUID()}`;
const email=`${mailbox}@example.com`;
const oldPassword=randomUUID();
const newPassword=randomUUID();
const created=await admin.auth.admin.createUser({email,password:oldPassword,email_confirm:true});
assert.equal(created.error,null);
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.route('**/auth/v1/**', async route => {
   if (new URL(route.request().url()).origin !== new URL(status.API_URL).origin) {
     await route.abort();
     throw new Error('App must use this local Supabase project for acceptance');
   }
   await route.continue();
 });
 await page.addInitScript(()=>localStorage.setItem('lockstock.locale','en'));
 await page.goto('http://127.0.0.1:3000/forgot-password');
 await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Send reset link'}).click();
 await page.getByRole('status').filter({hasText:'If an account exists'}).waitFor();
 let mail;
 for(let i=0;i<20;i++){
   const inbox=await fetch(`${status.MAILPIT_URL}/api/v1/messages`).then(r=>r.json());
   const found=inbox.messages.find(m=>m.To.some(t=>t.Address===email));
   if(found){mail=await fetch(`${status.MAILPIT_URL}/api/v1/message/${found.ID}`).then(r=>r.json());break;}
   await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(mail,'Recovery email delivered to local inbox');
 assert.ok(!/Alternatively, enter the code/i.test(mail.HTML + mail.Text), 'Recovery mail must not offer an unsupported code entry flow');
 const link=(mail.HTML.match(/href="([^"]+)"/)?.[1] || mail.Text.match(/https?:\/\/\S+/)?.[0]).replaceAll('&amp;','&');
 assert.ok(link.includes('/auth/v1/verify'));
 await page.goto(link);
 await page.getByLabel('New password',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/reset-password');
 assert.equal(new URL(page.url()).hash,'');
 await page.getByLabel('New password',{exact:true}).fill(newPassword);
 await page.getByLabel('Confirm password',{exact:true}).fill(newPassword);
 await page.getByRole('button',{name:'Save password'}).click();
 await page.getByRole('status').filter({hasText:'Password updated'}).waitFor();
 assert.ok((await login.auth.signInWithPassword({email,password:oldPassword})).error,'Old password rejected');
 assert.equal((await login.auth.signInWithPassword({email,password:newPassword})).error,null,'New password accepted');
 await login.auth.signOut();
 await page.goto(link);
 await page.getByRole('main').getByRole('alert').filter({hasText:'invalid or expired'}).waitFor();
 console.log('PASS: real local email, recovery redirect, URL scrub, password update, old-password rejection, new-password login, consumed-link rejection.');
} finally {
 await browser?.close();
 const removed=await admin.auth.admin.deleteUser(created.data.user.id);
 assert.equal(removed.error,null);
 console.log('Disposable recovery user removed; existing users unchanged.');
}
