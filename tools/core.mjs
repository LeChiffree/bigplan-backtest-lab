// Ortak çekirdek: indikator-akademi modüllerini SALT-OKUNUR içe aktarır.
// Motor matematiği (sim, io, agg, strategies, CALCS) tek kaynaktan gelir.
import { pathToFileURL } from 'node:url';

export const IA = 'C:/Users/GIGABAYT/indikator-akademi';
export const BP = 'D:/BigPlan';
export const DATA_ROOT = 'D:\\1mDataBinance';

const iou = (p) => pathToFileURL(IA + p).href;

export const io = await import(iou('/tools/bt/io.mjs'));
export const {
  TF_MS, TFS, loadFunding, fundingCost, dayInfo, pivots, anchoredVwap, higherDir,
  smaOf, emaOf, rollMax, rollMin, rankPct, trueRangeOf, sessionVwap, vwapRoll,
  vwapBands, listSymbols,
} = io;

export const simConst = await import(iou('/tools/bt/sim.mjs'));
export const { FEE, SLIP, SIDE, symbolStats, sampleEquity } = simConst;

export const aggm = await import(iou('/tools/bt/agg.mjs'));
export const { GRID, HIST_N, newAcc, addSymbolResult, mergeAcc, finalizeIndicator, histIndex } = aggm;

export const stratm = await import(iou('/tools/bt/strategies.mjs'));
export const { BT_STRATEGIES, BT_CATEGORY_OF } = stratm;

export const { CALCS } = await import(iou('/assets/js/engine/formulas.js'));
