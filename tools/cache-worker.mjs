// Binary veri önbelleği oluşturucu (worker tarafı)
import { workerData, parentPort } from 'node:worker_threads';
import { loadSeriesC } from './dataload.mjs';

const { symbols, tfs, force } = workerData;
let done = 0;
for (const symbol of symbols) {
  for (const tf of tfs) {
    try {
      await loadSeriesC(tf, symbol, { noBin: false, noMem: true });
    } catch (e) {
      parentPort.postMessage({ type: 'err', msg: `${symbol} ${tf}: ${e.message}` });
    }
    done++;
  }
  parentPort.postMessage({ type: 'progress', symbol, done });
}
parentPort.postMessage({ type: 'done' });
