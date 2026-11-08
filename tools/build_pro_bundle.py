# build_pro_bundle.py — Python (numpy/pandas/scipy/plotly) ile kantitatif metrikleri hesaplar,
# negatif total/2026 işlem başı getirili adayları eler ve hızlı yüklenen pro_bundle.json + plotly.min.js üretir.
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
        "kasa2026": round(float(np.sum(net_d[idx_2026:])), 1),
        "grossPosAll": round(float(np.sum(pos_d)), 1),
        "grossNegAll": round(float(np.sum(neg_d)), 1),
        "grossPos2526": round(float(np.sum(pos_d[idx_2025:])), 1),
        "grossNeg2526": round(float(np.sum(neg_d[idx_2025:])), 1),
        "maxDdAll": round(max_dd_all, 1),
        "maxDd2526": round(max_dd_2526, 1),
        "sharpeCash": round(sharpe_cash, 2),
        "r2Cash": r2_cash,
    }

# 7'li stride [n, w, sumR, sumLog, durSum, sumPos, sumNeg] -> kompakt 4'lü tam sayı [n, w, posC, negC]
# (posC = round(sumPos*100), negC = round(sumNeg*100); netC = posC - negC)
def pack_b7_to_b4(arr):
    out = []
    for i in range(0, len(arr), 7):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1])))
        out.append(int(round(arr[i + 5] * 100)))
        out.append(int(round(arr[i + 6] * 100)))
    return out

# dur için 5'li stride: [n, w, posC, negC, durDaysSum]
def pack_dur_b5(arr):
    out = []
    for i in range(0, len(arr), 7):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1])))
        out.append(int(round(arr[i + 5] * 100)))
        out.append(int(round(arr[i + 6] * 100)))
        out.append(int(round(arr[i + 4] / 24.0)))
    return out

# ret için 3'lü stride: [n, posC, negC]
def pack_ret_b3(arr):
    out = []
    for i in range(0, len(arr), 3):
        out.append(int(round(arr[i])))
        out.append(int(round(arr[i + 1] * 100)))
        out.append(int(round(arr[i + 2] * 100)))
    return out

# ls için 4'lü stride: [n, w, posC, negC] × (Long, Short)
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
    # coins: [ci, n, w, posC, negC, durDays]
    agg["coins"] = [
        [int(c[0]), int(c[1]), int(c[2]), int(round(c[6] * 100)), int(round(c[7] * 100)), round(c[5] / 24.0, 1)]
        for c in (agg.get("coins") or [])
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
                "ret": sum_packed(yrs_p, "ret"),
                "ls": sum_packed(yrs_p, "ls"),
            })
        st["sets"] = compact_sets

    if st.get("isSingle"):
        agg["coins"] = []
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

out_bundle = {
    "gen": pd.Timestamp.now("UTC").isoformat(),
    "grid": D["grid"],
    "idx2025": idx_2025,
    "idx2026": idx_2026,
    "symbols": D["symbols"],
    "keyTitle": D["keyTitle"],
    "vol": D["vol"],
    "strategies": [s for s in D["strategies"] if s["id"] in active_ids],
    "excludedNeg": [{"key": k, "totAvgPct": ta, "y26AvgPct": ya} for k, ta, ya in excluded_keys],
    "states": final_states,
}

raw_bytes = json.dumps(out_bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
with open(BUNDLE_PATH, "wb") as f:
    f.write(raw_bytes)
gz_bytes = gzip.compress(raw_bytes, compresslevel=6)

print(f"[python] pro_bundle.json: Raw {len(raw_bytes)/1048576:.2f} MB -> Gzip {len(gz_bytes)/1048576:.2f} MB · durum: {len(final_states)}")
