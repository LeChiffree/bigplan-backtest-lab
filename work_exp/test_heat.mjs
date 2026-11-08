import { newCompactAcc, heatTable, finalize2 } from '../tools/agg2.mjs';

const acc = newCompactAcc(3);
acc.syms[0] = 10;              // AAA: işlem var, diğer metrikler 0
acc.syms[2 * 11] = 6;          // CCC
acc.syms[2 * 11 + 2] = 0.012;  // avg
acc.syms[2 * 11 + 1] = 0.6;    // wr
acc.syms[2 * 11 + 3] = 2.5;    // pf
acc.syms[2 * 11 + 4] = 0.09;   // tot
acc.syms[2 * 11 + 5] = -0.07;  // dd
acc.syms[2 * 11 + 10] = 0.4;   // bh
console.log('heat:', JSON.stringify(heatTable(acc, ['AAA', 'BBB', 'CCC'])));
console.log('finalize2:', JSON.stringify(finalize2(acc, ['AAA', 'BBB', 'CCC'])));
