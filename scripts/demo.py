"""產生假資料以便在本機預覽版面。

用法：python scripts/demo.py  然後 python scripts/build.py
注意：這些數字全是亂數，只用來看版面，看完請執行 rm -rf data/daily 清掉。
"""
import random, sys, json
sys.path.insert(0,'scripts')
from datetime import timedelta
from common import today_tpe, iso, save_json, daily_path, STATUS_PATH, now_tpe
random.seed(7)
d=today_tpe(); made=0
names=[("2330","台積電"),("2317","鴻海"),("2454","聯發科"),("2308","台達電"),("3231","緯創"),
       ("6669","緯穎"),("2368","金像電"),("3017","奇鋐"),("6213","聯茂"),("2449","京元電子"),
       ("6672","騰輝電子-KY"),("7769","鴻勁"),("8069","元太"),("5347","世界"),("6488","環球晶")]
tw_m=3_150e8; tp_m=780e8; oi=21000
while made<45:
    if d.weekday()<5:
        tw_m+=random.uniform(-40e8,45e8); tp_m+=random.uniform(-9e8,9e8); oi+=random.randint(-3200,3300)
        rec={"date":iso(d),
         "twse_insti":{"foreign":random.uniform(-900e8,700e8),"trust":random.uniform(-60e8,90e8),
                       "dealer":random.uniform(-120e8,120e8),"total":0},
         "tpex_insti":{"foreign":random.uniform(-90e8,80e8),"trust":random.uniform(-20e8,30e8),
                       "dealer":random.uniform(-25e8,25e8),"total":0},
         "twse_margin":{"balance":tw_m,"prev":tw_m,"change":0},
         "tpex_margin":{"balance":tp_m,"prev":tp_m,"change":0},
         "taifex_tx":{"net_oi_lots":int(oi),"net_oi_value":int(oi*200000)},
         "flows":[{"c":c,"n":n,"m":"TWSE" if i<10 else "TPEX",
                   "f":round(random.uniform(-70e8,70e8)),"t":round(random.uniform(-9e8,9e8))}
                  for i,(c,n) in enumerate(names)]}
        save_json(daily_path(iso(d)),rec); made+=1
    d-=timedelta(days=1)
save_json(STATUS_PATH,{k:{"label":l,"ok":ok,"data_date":iso(today_tpe()),
    "updated_at":now_tpe().isoformat(timespec='seconds'),"error":None if ok else "connection timeout"}
    for k,l,ok in [("twse_insti","證交所三大法人",True),("tpex_insti","櫃買三大法人",True),
    ("twse_margin","上市融資餘額",True),("tpex_margin","上櫃融資餘額",True),
    ("taifex_tx","台指期外資未平倉",True),("stock_flows","個股買賣超排行",False)]})
print("mock written")
