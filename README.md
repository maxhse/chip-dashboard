# 法人籌碼儀錶板

上市櫃三大法人買賣超、融資餘額、台指期外資未平倉的單頁儀錶板。
資料由 GitHub Actions 定時抓取後存進本 repo，網頁由 GitHub Pages 靜態託管，不需要伺服器。

---

## 部署步驟

### 1. 建立 repo 並推上去

```bash
git init
git add .
git commit -m "初版"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git push -u origin main
```

repo 設成 Public 最省事（Private repo 要用 Pages 也可以，但需要付費方案）。

### 2. 開啟 GitHub Pages

Settings → Pages → Build and deployment
- Source：**Deploy from a branch**
- Branch：**main**，資料夾選 **/docs**

存檔後網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`。

### 3. 給 Actions 寫入權限

Settings → Actions → General → Workflow permissions
選 **Read and write permissions**，存檔。沒開這個，排程跑完會無法把資料 commit 回來。

### 4. 第一次回補歷史資料

Actions → 「更新籌碼資料」→ Run workflow →
在 **回補幾個日曆日** 填 `40`（約等於 28 個交易日）→ Run。

跑完約 3–6 分鐘。之後打開網頁就會有近 20 日的圖表與 1/3/5/10/20 日排行。

> 之後的排程執行不要填這個欄位，留白就好，它只做增量更新。

---

## 更新時間

| 排程 | 台北時間 |
|---|---|
| `*/15 6-10 * * 1-5` | 週一至週五 14:00–18:45，每 15 分鐘 |
| `5 13 * * 1-5` | 週一至週五 21:05（融資餘額約 21:00 更新） |

**GitHub Actions 的排程不保證準時。** 這是平台的已知行為，系統忙碌時可能延遲數分鐘到數十分鐘，
整點前後尤其明顯。如果需要分秒準確，要改成自架主機跑 cron。

---

## 資料來源與單位

| 區塊 | 來源 | 單位 |
|---|---|---|
| 上市三大法人買賣超 | TWSE `BFI82U` | 元 |
| 上櫃三大法人買賣超 | TPEx `insti/summary` | 元 |
| 上市融資餘額 | TWSE `MI_MARGN` (selectType=MS) | 仟元 → 換算為元 |
| 上櫃融資餘額 | TPEx `margin/balance` | 仟元 → 換算為元 |
| 台指期外資未平倉 | TAIFEX `futContractsDateDown` (TX) | 口 |
| 個股買賣超金額 | TWSE `T86` + TPEx `insti/dailyTrade` | 股數 × 當日均價 |

**外資** = 外資及陸資（不含外資自營商）＋ 外資自營商
**自營商** = 自營商（自行買賣）＋ 自營商（避險）

### 個股買賣超金額是估算值

證交所與櫃買中心的官方個股報表只公布**買賣超股數**，沒有金額欄位。
本專案的做法是取同日收盤行情的「成交金額 ÷ 成交股數」得到當日成交均價，
再乘上買賣超股數。方向與量級正確，但跟券商系統用逐筆成交價算出來的數字會有小幅差異。

換來的好處是：官方 API 吃日期參數，所以 1/3/5/10/20 日排行可以一次回補，
不必等資料自己累積一個月。

---

## 首次上線請核對這幾個數字

程式用**欄位名稱**去對應資料，比固定欄位順序穩，但單位換算仍值得人工確認一次。
第一次跑完後，拿網頁上的數字跟官方頁面對一下：

- 上市融資餘額總額量級是否合理（近年約 3,000 億上下）。若差了 1000 倍，
  調整 `scripts/sources.py` 最上面的 `TWSE_MARGIN_VALUE_UNIT`。
- 上櫃融資餘額同理，對應 `TPEX_MARGIN_VALUE_UNIT`。
- 台指期外資未平倉淨額口數，跟期交所頁面的「多空淨額 未平倉口數」是否一致。

---

## 抓取失敗時的行為

每個資料源獨立處理，互不影響：

- 某一項抓失敗 → **不會覆蓋**先前抓到的數字，網頁該來源的狀態點會轉紅，
  並顯示「上次成功 MM/DD HH:MM」。
- 抓取時會從最近的交易日往回試最多 6 天，所以假日、颱風假、資料延遲產製都能自動處理，
  網頁一律顯示**最近一個有資料的交易日**並標註日期。
- 只有六個來源**全部**失敗時，workflow 才會標記為失敗。

`data/status.json` 記錄每個來源的最後成功時間與最後一次的錯誤訊息，排錯時先看這個檔。

---

## 本機預覽

```bash
pip install requests
python scripts/demo.py      # 產生亂數假資料，只為了看版面
python scripts/build.py
python -m http.server 8000 --directory docs
# 開 http://localhost:8000
rm -rf data/daily && mkdir -p data/daily   # 看完清掉假資料
```

要用真實資料在本機測：跳過 `demo.py`，直接跑 `python scripts/backfill.py 10`。

---

## 檔案結構

```
scripts/
  common.py     HTTP、數字解析、日期、檔案讀寫
  sources.py    六個資料源的抓取與解析（欄位以名稱對應）
  update.py     增量更新，逐一處理各來源並記錄狀態
  backfill.py   回補歷史
  build.py      彙整成 docs/data/dashboard.json
  demo.py       產生假資料供本機預覽
data/
  daily/        每個交易日一個 JSON，是唯一的資料真相
  status.json   各來源最後成功時間
docs/           GitHub Pages 根目錄
  index.html  style.css  app.js
  data/dashboard.json    網頁唯一讀取的檔案
```

只有 `dashboard.json` 會被網頁讀取，約 40KB，全部圖表與排行都在裡面，開頁只有一次請求。
