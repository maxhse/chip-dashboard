"""印出三大法人彙總表的原始 API 回傳內容，用來核對真正的欄位/列名。

用法：
    python scripts/dump_raw.py            # 查最近一個交易日
    python scripts/dump_raw.py 2026-08-27  # 查指定日期

跟 verify_rank.py 不一樣：這支不做任何計算或猜測，就是把 API 原始回應
的 fields 跟 data 整段印出來，讓我們照著真正的結構修程式，不用再猜。
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta

from common import get_json, session, today_tpe


def parse_date(s: str) -> date:
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


def dump(title: str, url: str, params: dict, s) -> None:
    print(f"\n========== {title} ==========")
    print(f"URL: {url}")
    print(f"參數: {params}")
    try:
        j = get_json(s, url, params)
    except Exception as e:  # noqa: BLE001
        print(f"抓取失敗：{e}")
        return

    # 找出所有含有「表格」性質的節點（tables / fields+data），完整印出
    if "tables" in j:
        for i, t in enumerate(j["tables"]):
            print(f"\n--- tables[{i}] ---")
            print("fields:", json.dumps(t.get("fields"), ensure_ascii=False))
            data = t.get("data") or []
            print(f"data 共 {len(data)} 列，全部印出：")
            for row in data:
                print(" ", row)
            if t.get("summary"):
                print("summary:", t["summary"])
    elif "fields" in j:
        print("fields:", json.dumps(j.get("fields"), ensure_ascii=False))
        data = j.get("data") or []
        print(f"data 共 {len(data)} 列，全部印出：")
        for row in data:
            print(" ", row)
    else:
        print("找不到 tables/fields，完整印出前 2000 字元原始回應：")
        print(json.dumps(j, ensure_ascii=False)[:2000])


def main() -> None:
    target = parse_date(sys.argv[1]) if len(sys.argv) > 1 else None
    s = session()

    if target is None:
        d = today_tpe()
        while d.weekday() >= 5:
            d -= timedelta(days=1)
        target = d

    print(f"=== 查核日期 {target} ===")

    dump(
        "上市三大法人 BFI82U",
        "https://www.twse.com.tw/rwd/zh/fund/BFI82U",
        {"dayDate": target.strftime("%Y%m%d"), "type": "day", "response": "json"},
        s,
    )
    dump(
        "上櫃三大法人 insti/summary",
        "https://www.tpex.org.tw/www/zh-tw/insti/summary",
        {"type": "Daily", "date": target.strftime("%Y/%m/%d"), "response": "json"},
        s,
    )


if __name__ == "__main__":
    main()
