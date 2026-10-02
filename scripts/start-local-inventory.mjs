import { createServer } from 'node:net';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const address = 'http://127.0.0.1:8796/anmelden';
const probe = createServer();
try {
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(8796, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
} catch (error) {
  if (error.code !== 'EADDRINUSE') throw error;
  console.log('Port 8796 ist bereits belegt. Kein Prozess wird beendet.');
  console.log('Falls die lokale ChroniPlay-Testversion bereits laeuft: ' + address);
  process.exit(0);
}
if (!existsSync('node_modules/vinext/dist/cli.js')) throw new Error('Projektabhaengigkeiten fehlen. Bitte zuerst die vorhandene Projektinstallation reparieren.');
if (readdirSync('.').some(name => /^(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?)$/i.test(name))) {
  throw new Error('Lokale Secret-Dateien vorhanden. Diese reine Testumgebung verwendet keine Produktions-Secrets; bitte getrennte Arbeitskopie nutzen.');
}
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
for (const name of ['WORKERS_CI', 'WORKERS_CI_BRANCH', 'CI', 'CVK_ENABLE_REMOTE_TEST_BINDINGS', 'CLOUDFLARE_INCLUDE_PROCESS_ENV']) delete env[name];
async function run(args) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw new Error('Lokaler Start abgebrochen. Keine Cloudflare-Veroeffentlichung ausgefuehrt.');
}
console.log('Nur lokale Test-D1/R2, synthetische Konten. Kein Push oder Deployment.');
await run(['--import', './scripts/sites-env.mjs', 'scripts/run-framework.mjs', 'build']);
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
if (config.d1_databases?.some(b => b.remote || b.database_id !== '00000000-0000-4000-8000-000000000000') ||
    config.r2_buckets?.some(b => b.remote || b.bucket_name !== 'site-creator-r2')) {
  throw new Error('Unerwartete Ressourcenbindungen. Lokale Testanwendung nicht gestartet.');
}
console.log('Im Browser oeffnen: ' + address);
console.log('Beenden mit Strg+C. Testdaten bleiben beim Neustart erhalten.');
await run(['scripts/test-local.mjs', '--inventory']);
