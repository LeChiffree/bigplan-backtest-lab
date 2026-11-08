// pipeline_expand.mjs — genişletilmiş evren (520 sembol) tam boru hattı
// Aşamalar sırayla çalışır; her aşama bitince work_exp/stages/<ad>.done yazılır.
// Yeniden başlatmada tamamlanan aşamalar atlanır (--force ile hepsi yeniden).
// Kullanım: node tools/pipeline_expand.mjs [--force] [--from=stage] [--only=stage]
import { spawn } from 'node:child_process';
import { existsSync, createWriteStream, mkdirSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const LOGS = join(BP, 'work_exp', 'logs');
const ST = join(BP, 'work_exp', 'stages');
mkdirSync(LOGS, { recursive: true });
mkdirSync(ST, { recursive: true });

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const fromArg = argv.find((a) => a.startsWith('--from='))?.slice(7) || null;
const onlyArg = argv.find((a) => a.startsWith('--only='))?.slice(7) || null;

const STAGES = [
  { name: 'cache', args: ['tools/cache.mjs', '--workers=10'] },
  { name: 'bin-audit', args: ['work_exp/bin_audit.mjs'] },
  { name: 'market', args: ['tools/market.mjs'] },
  { name: 'baseline', args: ['tools/run2.mjs', 'baseline', '--workers=11'] },
  { name: 'singles-A', args: ['tools/run2.mjs', 'singles', '--group=A', '--workers=11'] },
  { name: 'singles-B', args: ['tools/run2.mjs', 'singles', '--group=B', '--workers=11'] },
  { name: 'qa-expand', args: ['tools/_qa_expand.mjs'] },
  { name: 'select', args: ['tools/select.mjs'] },
  { name: 'combos', args: ['tools/run2.mjs', 'combos', '--workers=11'] },
  { name: 'report', args: ['tools/report2.mjs'] },
  { name: 'dashboard', args: ['tools/dashboard.mjs'] },
  { name: 'daily-spec', args: ['tools/daily_spec.mjs'] },
  { name: 'daily', args: ['tools/rundaily.mjs', '--workers=11'] },
  { name: 'homogen', args: ['tools/homogen.mjs'] },
  { name: 'homogen-html', args: ['tools/homogen_html.mjs'] },
];

function runStage(st) {
  return new Promise((resolve, reject) => {
    const logPath = join(LOGS, st.name + '.log');
    const ws = createWriteStream(logPath, { flags: 'w' });
    const t0 = Date.now();
    const stamp = `[pipeline] === ${st.name} başladı ${new Date().toISOString()} ===`;
    console.log(stamp); ws.write(stamp + '\n');
    const child = spawn(process.execPath, st.args, { cwd: BP, windowsHide: true });
    const pipe = (data) => { const s = data.toString(); process.stdout.write(s); ws.write(s); };
    child.stdout.on('data', pipe);
    child.stderr.on('data', pipe);
    child.on('error', (e) => { ws.end(); reject(e); });
    child.on('exit', (code) => {
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      const msg = `[pipeline] === ${st.name} bitti: kod ${code}, ${secs}s ===`;
      console.log(msg); ws.write(msg + '\n'); ws.end();
      if (code === 0) resolve(); else reject(new Error(`${st.name} kod ${code}`));
    });
  });
}

let started = false;
for (const st of STAGES) {
  if (onlyArg && st.name !== onlyArg) continue;
  if (fromArg && !started) { if (st.name !== fromArg) continue; started = true; }
  const donePath = join(ST, st.name + '.done');
  const failPath = join(ST, st.name + '.fail');
  if (!force && existsSync(donePath)) { console.log(`[pipeline] ${st.name} zaten tamam — atlandı`); continue; }
  try {
    await runStage(st);
    await mkdir(ST, { recursive: true });
    await writeFile(donePath, new Date().toISOString());
    if (existsSync(failPath)) { try { (await import('node:fs/promises')).unlink(failPath); } catch {} }
  } catch (e) {
    await writeFile(failPath, new Date().toISOString() + ' ' + e.message);
    console.error(`[pipeline] DURDU: ${e.message}`);
    process.exit(1);
  }
}
console.log('[pipeline] TÜM AŞAMALAR TAMAM');
