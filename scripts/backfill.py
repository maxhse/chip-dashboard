"""回補歷史資料。用法：python scripts/backfill.py 40

第一次部署時跑一次，把過去 N 個日曆日的資料抓回來，
圖表與 1/3/5/10/20 日排行就不用等累積。對交易所禮貌一點，每天之間停 1 秒。
"""
from __future__ import annotations

import sys
import time
from datetime import timedelta

import sources as S
from common import (daily_path, iso, load_json, save_json, session, today_tpe)

JOBS = [
    ("twse_insti",  S.twse_institutional),
    ("tpex_insti",  S.tpex_institutional),
    ("twse_margin", S.twse_margin),
    ("tpex_margin", S.tpex_margin),
    ("taifex_tx",   S.taifex_tx_foreign),
    ("flows",       S.stock_flows),
]


def main() -> None:
    back = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    only = sys.argv[2:] or None
    s = session()

    d = today_tpe()
    for _ in range(back):
        if d.weekday() < 5:
            key = iso(d)
            rec = load_json(daily_path(key), {}) or {}
            rec["date"] = key
            got = []
            for field, fn in JOBS:
                if only and field not in only:
                    continue
                if rec.get(field):
                    got.append(f"{field}=skip")
                    continue
                try:
                    rec[field] = fn(s, d)
                    got.append(field)
                except Exception as e:  # noqa: BLE001
                    got.append(f"{field}!({str(e)[:40]})")
            if any(rec.get(f) for f, _ in JOBS):
                save_json(daily_path(key), rec)
            print(f"{key}: {' '.join(got)}")
            time.sleep(1)
        d -= timedelta(days=1)


if __name__ == "__main__":
    main()
