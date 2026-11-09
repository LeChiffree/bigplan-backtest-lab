# build_pro_bundle.py — Python (numpy/pandas/scipy/plotly) ile kantitatif metrikleri,
# 56+ filtre ısı haritası kataloğunu (Tüm Yıllar & 2026), çıkış nedenlerini (SL/TP/Flip/MaxBars),
# 8'li işlem süresi kovalarını ve en aktif 40 coini paketler.
import gzip
import json
import math
import os
import shutil
import numpy as np
import pandas as pd
import plotly

BP = r"D:\BigPlan"
RAW_PATH = os.path.join(BP, "out", "pro_data.json")
BUNDLE_PATH = os.path.join(BP, "out", "pro_bundle.json")
PLOTLY_DST = os.path.join(BP, "out", "plotly.min.js")
SINGLES_DIR = os.path.join(BP, "out", "singles")

plotly_src = os.path.join(os.path.dirname(plotly.__file__), "package_data", "plotly.min.js")
if os.path.exists(plotly_src):
    shutil.copy2(plotly_src, PLOTLY_DST)

with open(RAW_PATH, "r", encoding="utf-8") as f:
    D = json.load(f)

grid = D["grid"]
GD = grid["len"]
dates = [grid["start"] + i * grid["step"] for i in range(GD)]
years_arr = np.array([pd.Timestamp(ts, unit="ms", tz="UTC").year for ts in dates], dtype=np.int32)
idx_2025 = int(np.argmax(years_arr >= 2025))
idx_2026 = int(np.argmax(years_arr >= 2026))

def compute_cash_stats(day_pos_c, day_neg_c):
    pos_d = np.asarray(day_pos_c, dtype=np.float64) * 0.1
    neg_d = np.asarray(day_neg_c, dtype=np.float64) * 0.1
    net_d = pos_d - neg_d

    cum_all = np.cumsum(net_d)
    peak_all = np.maximum.accumulate(np.maximum(0.0, cum_all))
    dd_all = cum_all - peak_all
    max_dd_all = float(np.min(dd_all)) if len(dd_all) else 0.0

    net_2526 = net_d[idx_2025:]
    cum_2526 = np.cumsum(net_2526)
    peak_2526 = np.maximum.accumulate(np.maximum(0.0, cum_2526))
    dd_2526 = cum_2526 - peak_2526
    max_dd_2526 = float(np.min(dd_2526)) if len(dd_2526) else 0.0

    net_2026 = net_d[idx_2026:]
    cum_2026 = np.cumsum(net_2026)
    peak_2026 = np.maximum.accumulate(np.maximum(0.0, cum_2026))
    dd_2026 = cum_2026 - peak_2026
    max_dd_2026 = float(np.min(dd_2026)) if len(dd_2026) else 0.0

    sd = float(np.std(net_d))
    sharpe_cash = float((np.mean(net_d) / sd) * math.sqrt(365.0)) if sd > 1e-9 else 0.0

    if len(cum_all) > 2 and np.std(cum_all) > 1e-9:
        r_val = float(np.corrcoef(np.arange(len(cum_all)), cum_all)[0, 1])
        r2_cash = round(r_val * r_val, 4) if r_val > 0 else 0.0
    else:
        r2_cash = 0.0

    return {
        "kasaAll": round(float(cum_all[-1]) if len(cum_all) else 0.0, 1),
        "kasa2526": round(float(cum_2526[-1]) if len(cum_2526) else 0.0, 1),
        "kasa2026": round(float(np.sum(net_2026)), 1),
        "grossPosAll": round(float(np.sum(pos_d)), 1),
        "grossNegAll": round(float(np.sum(neg_d)), 1),
        "grossPos2026": round(float(np.sum(pos_d[idx_2026:])), 1),
        "grossNeg2026": round(float(np.sum(neg_d[idx_2026:])), 1),
        "maxDdAll": round(max_dd_all, 1),
        "maxDd2526": round(max_dd_2526, 1),
        "maxDd2026": round(max_dd_2026, 1),
        "sharpeCash": round(sharpe_cash, 2),
        "r2Cash": r2_cash,
    }

def pack_b7_to_b4(arr):
    out = []
    for i in range(0, len(arr), 7):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1])))
        out.append(int(round(arr[i + 5] * 100)))
        out.append(int(round(arr[i + 6] * 100)))
    return out

def pack_dur_b5(arr):
    out = []
    for i in range(0, len(arr), 7):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1])))
        out.append(int(round(arr[i + 5] * 100)))
        out.append(int(round(arr[i + 6] * 100)))
        out.append(int(round(arr[i + 4]))) # toplam saat
    return out

def pack_ret_b3(arr):
    out = []
    for i in range(0, len(arr), 3):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1] * 100)))
        out.append(int(round(arr[i + 2] * 100)))
    return out

def pack_ls_b4(arr):
    out = []
    for i in range(0, len(arr), 5):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1])))
        out.append(int(round(arr[i + 3] * 100)))
        out.append(int(round(arr[i + 4] * 100)))
    return out

def pack_year(Y):
    return {
        "n": int(Y["n"]),
        "w": int(Y["w"]),
        "sumR": round(Y["sumR"], 2),
        "sumPos": round(Y["sumPos"], 2),
        "sumNeg": round(Y["sumNeg"], 2),
        "durSum": round(Y["durSum"], 0),
        "dow": pack_b7_to_b4(Y["dow"]),
        "month": pack_b7_to_b4(Y["month"]),
        "quarter": pack_b7_to_b4(Y["quarter"]),
        "season": pack_b7_to_b4(Y["season"]),
        "hour": pack_b7_to_b4(Y["hour"]),
        "dur": pack_dur_b5(Y["dur"]),
        "exit": pack_b7_to_b4(Y.get("exit") or [0]*28),
        "ret": pack_ret_b3(Y["ret"]),
        "ls": pack_ls_b4(Y["ls"]),
    }

def sum_packed(years_packed, key):
    arr = np.zeros(len(years_packed[0][key]), dtype=np.int64)
    for Y in years_packed:
        arr += np.asarray(Y[key], dtype=np.int64)
    return [int(x) for x in arr]

valid_states = []
excluded_keys = []

for st in D["states"]:
    agg = st["agg"]
    n_tot = agg["n"]
    sum_r = agg["sumR"]
    tot_avg = (sum_r / n_tot) if n_tot > 0 else -1.0

    y26 = agg["years"][4]
    y26_n = y26["n"]
    y26_avg = (y26["sumR"] / y26_n) if y26_n > 0 else -1.0

    y25 = agg["years"][3]
    n_2526 = y25["n"] + y26["n"]
    avg_2526 = ((y25["sumR"] + y26["sumR"]) / n_2526) if n_2526 > 0 else 0.0

    st["totAvg"] = round(tot_avg, 5)
    st["y26Avg"] = round(y26_avg, 5)
    st["avg2526"] = round(avg_2526, 5)
    st["posBoth"] = bool(tot_avg > 0 and y26_avg > 0)

    cstats = compute_cash_stats(agg["dayPosC"], agg["dayNegC"])
    st["cash"] = cstats

    w_tot = agg["w"]
    l_tot = max(0, n_tot - w_tot)
    avg_win = (agg["sumPos"] / w_tot) if w_tot > 0 else 0.0
    avg_loss = (agg["sumNeg"] / l_tot) if l_tot > 0 else 0.0
    pf = (agg["sumPos"] / agg["sumNeg"]) if agg["sumNeg"] > 1e-9 else 99.0
    payoff = (avg_win / avg_loss) if avg_loss > 1e-9 else 99.0
    st["pf"] = round(pf, 2)
    st["payoff"] = round(payoff, 2)
    st["exp10"] = round(tot_avg * 10.0, 3)
    st["exp10_26"] = round(y26_avg * 10.0, 3)

    agg["years"] = [pack_year(Y) for Y in agg["years"]]
    # coins: [ci, n, w, posC, negC, durHours]
    agg["coins"] = [
        [int(c[0]), int(c[1]), int(c[2]), int(round(c[6] * 100)), int(round(c[7] * 100)), round(c[5], 1)]
        for c in (agg.get("coins") or [])
    ]
    agg["coins26"] = [
        [int(c[0]), int(c[1]), int(c[2]), int(round(c[6] * 100)), int(round(c[7] * 100)), round(c[5], 1)]
        for c in (agg.get("coins26") or [])
    ]

    if st.get("sets"):
        compact_sets = []
        for s_obj in st["sets"]:
            yrs_p = [pack_year(Y) for Y in s_obj["years"]]
            compact_sets.append({
                "n": int(s_obj["n"]), "w": int(s_obj["w"]), "sumR": round(s_obj["sumR"], 2),
                "sumPos": round(s_obj["sumPos"], 2), "sumNeg": round(s_obj["sumNeg"], 2),
                "durSum": round(s_obj["durSum"], 0),
                "ySum": [[Y["n"], Y["w"], int(round(Y["sumPos"] * 100)), int(round(Y["sumNeg"] * 100)), int(Y["durSum"])] for Y in yrs_p],
                "dow": sum_packed(yrs_p, "dow"),
                "month": sum_packed(yrs_p, "month"),
                "quarter": sum_packed(yrs_p, "quarter"),
                "season": sum_packed(yrs_p, "season"),
                "hour": sum_packed(yrs_p, "hour"),
                "dur": sum_packed(yrs_p, "dur"),
                "exit": sum_packed(yrs_p, "exit"),
                "ret": sum_packed(yrs_p, "ret"),
                "ls": sum_packed(yrs_p, "ls"),
                "y26": yrs_p[4],
            })
        st["sets"] = compact_sets

    if st.get("isSingle"):
        agg["coins"] = []
        agg["coins26"] = []
        agg["samples"] = []
        st["sets"] = None
        st["dretSets"] = None
        st["dret"] = None

    if not st["posBoth"]:
        st["isCandidate"] = False
        excluded_keys.append((st["key"], round(tot_avg * 100, 2), round(y26_avg * 100, 2)))
        if st["kind"] != "temel" and not st["isSingle"]:
            continue
    else:
        st["isCandidate"] = not st["isSingle"]

    valid_states.append(st)

active_cells = set(
    f"{s['id']}|{s['tf']}" for s in valid_states if s.get("isCandidate") and s.get("posBoth")
)
final_states = [s for s in valid_states if f"{s['id']}|{s['tf']}" in active_cells]
active_ids = sorted(set(s["id"] for s in final_states))

# 56+ Filtre Kataloğu Heatmap Verisi (out/singles/<id>.A.json + B.json'dan Tüm Yıllar ve 2026)
filter_catalog = []
cell_filter_stats = {} # "id|tf" -> [[n, wr_bp, avg_bp, tot_c, n26, wr26_bp, avg26_bp, tot26_c], ...]

for idx_id, sid in enumerate(active_ids):
    fa_path = os.path.join(SINGLES_DIR, f"{sid}.A.json")
    fb_path = os.path.join(SINGLES_DIR, f"{sid}.B.json")
    if not (os.path.exists(fa_path) and os.path.exists(fb_path)):
        continue
    fa = json.load(open(fa_path, encoding="utf-8"))
    fb = json.load(open(fb_path, encoding="utf-8"))
    if not filter_catalog:
        for fmeta in (fa.get("filters", []) + fb.get("filters", [])):
            filter_catalog.append({
                "k": fmeta["k"],
                "title": fmeta.get("title", fmeta["k"]),
                "cat": fmeta.get("catTitle") or fmeta.get("cat") or "",
            })
    for cell_key in active_cells:
        cid, ctf = cell_key.split("|")
        if cid != sid:
            continue
        va = (fa.get("tf", {}).get(ctf) or {}).get("v") or {}
        vb = (fb.get("tf", {}).get(ctf) or {}).get("v") or {}
        rows_f = []
        for fmeta in filter_catalog:
            fk = fmeta["k"]
            node = va.get(fk) or vb.get(fk)
            if not node or not node.get("sum"):
                rows_f.append([0, 0, 0, 0, 0, 0, 0, 0])
                continue
            sm = node["sum"]
            fn = int(sm.get("n") or 0)
            fwr = round(float(sm.get("wr") or 0) * 100, 1)
            favg = round(float(sm.get("avg") or 0) * 100, 2) # % cinsinden ort R
            ftot = round(fn * float(sm.get("avg") or 0) * 10, 1) # $10 kasa net $
            y26_arr = (node.get("years") or {}).get("2026") or [0, 0, 0] # [avg, wr, n]
            n26 = int(y26_arr[2] or 0)
            wr26 = round(float(y26_arr[1] or 0) * 100, 1)
            avg26 = round(float(y26_arr[0] or 0) * 100, 2)
            tot26 = round(n26 * float(y26_arr[0] or 0) * 10, 1)
            rows_f.append([fn, fwr, favg, ftot, n26, wr26, avg26, tot26])
        cell_filter_stats[cell_key] = rows_f

out_bundle = {
    "gen": pd.Timestamp.now("UTC").isoformat(),
    "grid": D["grid"],
    "idx2025": idx_2025,
    "idx2026": idx_2026,
    "symbols": D["symbols"],
    "keyTitle": D["keyTitle"],
    "vol": D["vol"],
    "strategies": [s for s in D["strategies"] if s["id"] in active_ids],
    "filterCatalog": filter_catalog,
    "cellFilterStats": cell_filter_stats,
    "excludedNeg": [{"key": k, "totAvgPct": ta, "y26AvgPct": ya} for k, ta, ya in excluded_keys],
    "states": final_states,
}

raw_bytes = json.dumps(out_bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
with open(BUNDLE_PATH, "wb") as f:
    f.write(raw_bytes)
gz_bytes = gzip.compress(raw_bytes, compresslevel=6)

print(f"[python] pro_bundle.json: Raw {len(raw_bytes)/1048576:.2f} MB -> Gzip {len(gz_bytes)/1048576:.2f} MB · durum: {len(final_states)} · filtre katalog: {len(filter_catalog)}")
