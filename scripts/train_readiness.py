#!/usr/bin/env python3
"""Train Aether's explainable readiness model.

WHOOP's recovery score is a closed 0–100. This script fits a ridge model on
synthetic athlete-days whose generative process follows published physiology:

- ln(RMSSD) z-score vs personal baseline (HRV4Training / Plews)
- Resting HR inverse coupling with HRV
- Sleep performance, efficiency, slow-wave and REM fractions
- Banister-style acute/chronic load and training stress balance
- Gabbett acute:chronic workload ratio
- Skin temp / respiratory / SpO2 deviations (illness proxies)
- Same-day behaviors (alcohol, travel, illness)

The exported weights are used in the app with full feature attribution.
This is not a claim that we beat WHOOP's lab on a clinical trial — it is an
open, inspectable alternative trained on sports-science priors, then
personalized on-device from the wearer's own history.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

FEATURES = [
    "hrv_ln_z",
    "rhr_z",
    "sleep_performance",
    "sleep_efficiency",
    "sleep_debt_h",
    "deep_frac",
    "rem_frac",
    "yday_load",
    "atl_norm",
    "tsb_norm",
    "acwr",
    "temp_z",
    "resp_z",
    "spo2_z",
    "alcohol",
    "illness",
    "travel",
    "consecutive_low_hrv",
    "sleep_regularity",
    "soreness",
]

# Literature-shaped linear effects on a 0–100 readiness target.
TRUE_WEIGHTS = np.array(
    [
        14.5,  # higher HRV z
        -9.0,  # elevated RHR
        18.0,  # sleep performance 0–1
        8.0,  # efficiency 0–1
        -4.2,  # hours of debt
        7.0,  # deep fraction
        5.0,  # REM fraction
        -6.5,  # yesterday load 0–1
        -5.5,  # high ATL
        6.0,  # positive TSB (fresh)
        -8.0,  # ACWR above ~1
        -4.5,  # skin temp up
        -3.5,  # respiratory rate up
        3.0,  # SpO2 up
        -11.0,  # alcohol
        -14.0,  # illness
        -5.0,  # travel / jet lag
        -3.8,  # consecutive low HRV days
        7.5,  # sleep regularity 0–1
        -6.0,  # soreness 0–1
    ],
    dtype=np.float64,
)
TRUE_BIAS = 58.0
RIDGE = 2.5
N = 14000
RNG = np.random.default_rng(42)


def simulate() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = N
    hrv_ln_z = RNG.normal(0, 1, n)
    rhr_z = -0.55 * hrv_ln_z + RNG.normal(0, 0.7, n)
    sleep_performance = np.clip(0.72 + 0.08 * hrv_ln_z + RNG.normal(0, 0.08, n), 0.35, 1.0)
    sleep_efficiency = np.clip(0.88 + 0.04 * hrv_ln_z + RNG.normal(0, 0.04, n), 0.7, 0.99)
    sleep_debt_h = np.clip(RNG.gamma(1.2, 0.55, n) - 0.2 * sleep_performance, 0, 4.5)
    deep_frac = np.clip(RNG.normal(0.20, 0.05, n), 0.08, 0.35)
    rem_frac = np.clip(RNG.normal(0.21, 0.05, n), 0.08, 0.35)
    yday_load = np.clip(RNG.beta(2.2, 3.2, n), 0, 1)
    atl_norm = np.clip(0.35 * yday_load + RNG.beta(2.0, 3.0, n) * 0.7, 0, 1.4)
    ctl = np.clip(RNG.normal(0.45, 0.15, n), 0.1, 1.0)
    tsb_norm = np.clip((ctl - atl_norm + 0.15) / 0.8, -1.5, 1.5)
    acwr = np.clip(atl_norm / np.maximum(ctl, 0.12) + RNG.normal(0, 0.08, n), 0.3, 2.4)
    temp_z = RNG.normal(0, 1, n) + 0.35 * (acwr > 1.4)
    resp_z = 0.4 * rhr_z + RNG.normal(0, 0.8, n)
    spo2_z = RNG.normal(0, 1, n) - 0.25 * (temp_z > 1)
    alcohol = RNG.random(n) < 0.13
    illness = RNG.random(n) < 0.05
    travel = RNG.random(n) < 0.07
    consecutive_low_hrv = np.clip(
        (hrv_ln_z < -0.8).astype(float) * RNG.integers(0, 4, n), 0, 6
    )
    sleep_regularity = np.clip(0.78 + 0.06 * hrv_ln_z + RNG.normal(0, 0.1, n), 0.3, 1.0)
    soreness = np.clip(0.45 * yday_load + 0.2 * atl_norm + RNG.random(n) * 0.3, 0, 1)

    X = np.column_stack(
        [
            hrv_ln_z,
            rhr_z,
            sleep_performance,
            sleep_efficiency,
            sleep_debt_h,
            deep_frac,
            rem_frac,
            yday_load,
            atl_norm,
            tsb_norm,
            acwr,
            temp_z,
            resp_z,
            spo2_z,
            alcohol.astype(float),
            illness.astype(float),
            travel.astype(float),
            consecutive_low_hrv,
            sleep_regularity,
            soreness,
        ]
    )
    noise = RNG.normal(0, 4.5, n)
    y = np.clip(TRUE_BIAS + X @ TRUE_WEIGHTS + noise, 5, 98)

    # Next-day "problem" label: overreach / illness / crash (for risk head).
    risk = (
        (y < 34).astype(float)
        + (acwr > 1.45).astype(float)
        + illness.astype(float)
        + (hrv_ln_z < -1.4).astype(float)
        + (consecutive_low_hrv >= 3).astype(float)
    )
    risk = (risk >= 2).astype(float)
    return X, y, risk


def standardize(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std = np.where(std < 1e-6, 1.0, std)
    return (X - mean) / std, mean, std


def ridge(X: np.ndarray, y: np.ndarray, l2: float) -> np.ndarray:
    n_features = X.shape[1]
    A = X.T @ X + l2 * np.eye(n_features)
    b = X.T @ y
    return np.linalg.solve(A, b)


def logistic_ridge(X: np.ndarray, y: np.ndarray, l2: float, steps: int = 80) -> np.ndarray:
    w = np.zeros(X.shape[1] + 1)
    Xb = np.column_stack([np.ones(len(X)), X])
    lr = 0.08
    for _ in range(steps):
        z = np.clip(Xb @ w, -20, 20)
        p = 1 / (1 + np.exp(-z))
        grad = Xb.T @ (p - y) / len(y)
        grad[1:] += l2 * w[1:] / len(y)
        w -= lr * grad
    return w


def main() -> None:
    X, y, risk = simulate()
    Xs, mean, std = standardize(X)
    Xb = np.column_stack([np.ones(len(Xs)), Xs])
    w_ready = ridge(Xb, y, RIDGE)
    w_risk = logistic_ridge(Xs, risk, 1.0)

    y_hat = Xb @ w_ready
    rmse = float(np.sqrt(np.mean((y_hat - y) ** 2)))
    mae = float(np.mean(np.abs(y_hat - y)))
    r2 = float(1 - np.sum((y - y_hat) ** 2) / np.sum((y - y.mean()) ** 2))

    z = np.clip(np.column_stack([np.ones(len(Xs)), Xs])[:, 1:] @ w_risk[1:] + w_risk[0], -20, 20)
    p = 1 / (1 + np.exp(-z))
    acc = float(np.mean(((p >= 0.5) == (risk >= 0.5))))

    payload = {
        "version": "aether-readiness-v1",
        "name": "Aether Open Readiness",
        "samples": int(N),
        "rmse": round(rmse, 3),
        "mae": round(mae, 3),
        "r2": round(r2, 3),
        "risk_accuracy": round(acc, 3),
        "features": FEATURES,
        "mean": [round(float(v), 5) for v in mean],
        "std": [round(float(v), 5) for v in std],
        "readiness": {
            "bias": round(float(w_ready[0]), 5),
            "weights": [round(float(v), 5) for v in w_ready[1:]],
        },
        "risk": {
            "bias": round(float(w_risk[0]), 5),
            "weights": [round(float(v), 5) for v in w_risk[1:]],
        },
        "notes": [
            "Generative priors: Plews HRV, Banister fitness-fatigue, Gabbett ACWR, sleep architecture.",
            "On-device personalization blends these weights with a ridge fit on the wearer's own days.",
        ],
    }

    out = Path(__file__).resolve().parents[1] / "src" / "lib" / "model-weights.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out}")
    print(f"readiness RMSE={rmse:.2f} MAE={mae:.2f} R2={r2:.3f}")
    print(f"risk accuracy={acc:.3f}")


if __name__ == "__main__":
    main()
