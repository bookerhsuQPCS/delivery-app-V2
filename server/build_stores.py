# File: server/build_stores.py
import os
import re
import csv
import glob
import json
import argparse

# 1. 命令列參數
parser = argparse.ArgumentParser(description="抽取雙北餐飲與手搖飲資料 (純原生 Python，免安裝套件)")
parser.add_argument('--food', type=int, default=10, help='每區餐飲美食筆數 (預設: 10)')
parser.add_argument('--drink', type=int, default=5, help='每區手搖飲料筆數 (預設: 5)')
args = parser.parse_args()

FOOD_LIMIT = args.food
DRINK_LIMIT = args.drink

# 2. 自動搜尋兩份 CSV 檔案
def find_file(keyword):
    patterns = [
        f"*{keyword}*",
        os.path.join("..", f"*{keyword}*"),
        os.path.join(".", f"*{keyword}*")
    ]
    for p in patterns:
        matches = glob.glob(p)
        if matches:
            return matches[0]
    return None

tpe_path = find_file("設址臺北市所營事業含餐館業清冊")
ntpc_path = find_file("新北市餐飲業者")

if not tpe_path or not ntpc_path:
    raise FileNotFoundError(f"找不到 CSV 檔案！請確認目錄中是否有臺北與新北清冊。搜尋結果: 臺北={tpe_path}, 新北={ntpc_path}")

print(f"==================================================")
print(f" 參數: 每區美食 = {FOOD_LIMIT} 筆 | 每區飲料 = {DRINK_LIMIT} 筆")
print(f" 臺北來源: {tpe_path}")
print(f" 新北來源: {ntpc_path}")
print(f"==================================================")

# 使用 Python 內建 csv 模組讀取
with open(tpe_path, mode='r', encoding='utf-8') as f:
    tpe_rows = list(csv.DictReader(f))

with open(ntpc_path, mode='r', encoding='utf-8') as f:
    ntpc_rows = list(csv.DictReader(f))

def extract_tpe_district(addr):
    m = re.search(r'(?:臺北市|台北市)([^\d區]+區)', str(addr))
    return m.group(1) if m else '其他'

def extract_ntpc_district(addr):
    m = re.search(r'(?:新北市)?(?:\d{3})?([^\d區]+區)', str(addr))
    return m.group(1) if m else '其他'

districts_tpe = ['信義區', '大安區', '中山區', '中正區', '松山區', '南港區', '內湖區', '士林區', '北投區', '萬華區', '大同區', '文山區']
districts_ntpc = ['汐止區', '板橋區', '中和區', '永和區', '三重區', '新莊區', '新店區', '蘆洲區', '土城區', '淡水區']

drink_kw = '茶|飲|手搖|咖啡|冰|果汁|奶茶|鮮茶|冷飲|茶飲|豆花|清心|嵐|麻古|迷客夏|可不可|五十嵐|大苑子|五桐號|得正|路易莎|星巴克|TEA'
food_kw = '食堂|餐|麵|飯|鍋|小吃|廚房|坊|館|料理|堡|壽司|烤|湯包|拉麵'

all_stores = []

# 1. 臺北市：從原始 CSV 抽取
for d in districts_tpe:
    sub = [r for r in tpe_rows if extract_tpe_district(r.get('商業地址', '')) == d]
    names = set()
    
    # 美食
    food_sub = [r for r in sub if re.search(food_kw, r.get('商業名稱', ''))]
    if len(food_sub) < FOOD_LIMIT: food_sub = sub
    cnt = 0
    for r in food_sub:
        name = re.sub(r'[\ue000-\uf8ff]', '', str(r.get('商業名稱', ''))).strip()
        if not name or name in names: continue
        names.add(name)
        try:
            lat = round(float(r['Latitude']), 6)
            lng = round(float(r['Longitude']), 6)
        except: continue
        all_stores.append({
            'name': name,
            'coords': [lat, lng],
            'address': str(r.get('商業地址', '')).strip().replace('臺北市', '台北市'),
            'district': d,
            'region': f'台北市 ({d})',
            'category': '餐飲美食'
        })
        cnt += 1
        if cnt >= FOOD_LIMIT: break

    # 飲料
    drink_sub = [r for r in sub if re.search(drink_kw, r.get('商業名稱', ''), re.IGNORECASE)]
    cnt = 0
    for r in drink_sub:
        name = re.sub(r'[\ue000-\uf8ff]', '', str(r.get('商業名稱', ''))).strip()
        if not name or name in names: continue
        names.add(name)
        try:
            lat = round(float(r['Latitude']), 6)
            lng = round(float(r['Longitude']), 6)
        except: continue
        all_stores.append({
            'name': name,
            'coords': [lat, lng],
            'address': str(r.get('商業地址', '')).strip().replace('臺北市', '台北市'),
            'district': d,
            'region': f'台北市 ({d})',
            'category': '手搖飲品'
        })
        cnt += 1
        if cnt >= DRINK_LIMIT: break

# 2. 新北市各區飲料手搖名店備援
ntpc_preset_drinks = {
    '汐止區': [
        {'name': '清心福全 汐止大同店', 'coords': [25.06945, 121.66312], 'address': '新北市汐止區大同路二段312號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '手搖飲料'},
        {'name': '50嵐 汐止新台五店', 'coords': [25.0618, 121.6519], 'address': '新北市汐止區新台五路一段160號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '手搖飲料'},
        {'name': '麻古茶坊 汐止中興店', 'coords': [25.06412, 121.65689], 'address': '新北市汐止區中興路150號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '手搖飲料'},
        {'name': '可不可熟成紅茶 汐止忠孝店', 'coords': [25.0668, 121.6601], 'address': '新北市汐止區忠孝東路288號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '手搖飲料'},
        {'name': '迷客夏 汐止建成店', 'coords': [25.0742, 121.6675], 'address': '新北市汐止區建成路57巷1號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '手搖飲料'}
    ],
    '土城區': [
        {'name': '50嵐 土城海山店', 'coords': [24.9852, 121.4485], 'address': '新北市土城區裕民路95號', 'district': '土城區', 'region': '新北市 (土城區)', 'category': '手搖飲料'},
        {'name': '麻古茶坊 土城裕民店', 'coords': [24.9861, 121.4498], 'address': '新北市土城區裕民路130號', 'district': '土城區', 'region': '新北市 (土城區)', 'category': '手搖飲料'},
        {'name': '清心福全 土城中央店', 'coords': [24.9725, 121.4412], 'address': '新北市土城區中央路二段218號', 'district': '土城區', 'region': '新北市 (土城區)', 'category': '手搖飲料'},
        {'name': '可不可熟成紅茶 土城學府店', 'coords': [24.9882, 121.4525], 'address': '新北市土城區學府路一段168號', 'district': '土城區', 'region': '新北市 (土城區)', 'category': '手搖飲料'},
        {'name': '迷客夏 土城金城店', 'coords': [24.9815, 121.4632], 'address': '新北市土城區金城路三段12號', 'district': '土城區', 'region': '新北市 (土城區)', 'category': '手搖飲料'}
    ],
    '新莊區': [
        {'name': '麻古茶坊 新莊富國店', 'coords': [25.0268, 121.4245], 'address': '新北市新莊區富國路125號', 'district': '新莊區', 'region': '新北市 (新莊區)', 'category': '手搖飲料'},
        {'name': '50嵐 新莊幸福店', 'coords': [25.0512, 121.4558], 'address': '新北市新莊區幸福路732號', 'district': '新莊區', 'region': '新北市 (新莊區)', 'category': '手搖飲料'},
        {'name': '可不可熟成紅茶 新莊中正店', 'coords': [25.0358, 121.4512], 'address': '新北市新莊區中正路218號', 'district': '新莊區', 'region': '新北市 (新莊區)', 'category': '手搖飲料'},
        {'name': '得正#新莊幸福計劃', 'coords': [25.0521, 121.4532], 'address': '新北市新莊區幸福路676號', 'district': '新莊區', 'region': '新北市 (新莊區)', 'category': '手搖飲料'},
        {'name': '迷客夏 新莊民安店', 'coords': [25.0215, 121.4285], 'address': '新北市新莊區民安路188巷2號', 'district': '新莊區', 'region': '新北市 (新莊區)', 'category': '手搖飲料'}
    ]
}

xizhi_preset_foods = [
    {'name': '五堵鐵板燒 美食館', 'coords': [25.0768, 121.6785], 'address': '新北市汐止區長安路 (近五堵車站)', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '八方雲集 汐止長安店', 'coords': [25.0782, 121.6812], 'address': '新北市汐止區長安路62號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '麥當勞 汐止大同店', 'coords': [25.0718, 121.6668], 'address': '新北市汐止區大同路二段427號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '肯德基 汐止新台五店', 'coords': [25.0615, 121.6512], 'address': '新北市汐止區新台五路一段152號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '汐止中正老街 鍋貼專賣', 'coords': [25.0682, 121.6610], 'address': '新北市汐止區中正路128號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '爭鮮迴轉壽司 汐止中興店', 'coords': [25.0645, 121.6565], 'address': '新北市汐止區中興路168-1號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '銘記越南美食', 'coords': [25.0688, 121.6288], 'address': '新北市汐止區康寧街536號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '天然茶莊', 'coords': [25.0412, 121.6521], 'address': '新北市汐止區汐碇路380巷30號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'},
    {'name': '原汁牛肉麵 汐止福德店', 'coords': [25.0648, 121.6425], 'address': '新北市汐止區福德一路168號', 'district': '汐止區', 'region': '新北市 (汐止區)', 'category': '餐飲美食'}
]

# 2. 新北市
for d in districts_ntpc:
    sub = [r for r in ntpc_rows if extract_ntpc_district(r.get('Add', '')) == d]
    names = set()
    cnt = 0
    for r in sub:
        name = str(r.get('Name', '')).strip()
        if not name or name in names: continue
        names.add(name)
        addr = re.sub(r'新北市\d{3}', '新北市', str(r.get('Add', ''))).strip()
        try:
            lat = round(float(r['Py']), 6)
            lng = round(float(r['Px']), 6)
        except: continue
        all_stores.append({
            'name': name,
            'coords': [lat, lng],
            'address': addr,
            'district': d,
            'region': f'新北市 ({d})',
            'category': '餐飲美食'
        })
        cnt += 1
        if cnt >= FOOD_LIMIT: break

    # 汐止補齊美食
    if cnt < FOOD_LIMIT and d == '汐止區':
        for item in xizhi_preset_foods:
            if item['name'] not in names and cnt < FOOD_LIMIT:
                all_stores.append(item)
                names.add(item['name'])
                cnt += 1

    # 飲料
    drink_sub = [r for r in sub if re.search(drink_kw, r.get('Name', ''))]
    d_cnt = 0
    for r in drink_sub:
        name = str(r.get('Name', '')).strip()
        if not name or name in names: continue
        names.add(name)
        addr = re.sub(r'新北市\d{3}', '新北市', str(r.get('Add', ''))).strip()
        try:
            lat = round(float(r['Py']), 6)
            lng = round(float(r['Px']), 6)
        except: continue
        all_stores.append({
            'name': name,
            'coords': [lat, lng],
            'address': addr,
            'district': d,
            'region': f'新北市 ({d})',
            'category': '手搖飲品'
        })
        d_cnt += 1
        if d_cnt >= DRINK_LIMIT: break

    # 飲料不足補齊
    if d_cnt < DRINK_LIMIT and d in ntpc_preset_drinks:
        for item in ntpc_preset_drinks[d]:
            if item['name'] not in names and d_cnt < DRINK_LIMIT:
                all_stores.append(item)
                names.add(item['name'])
                d_cnt += 1

# 3. 輸出乾淨 JSON
out_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(out_dir, exist_ok=True)
out_file = os.path.join(out_dir, 'stores.json')

with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(all_stores, f, ensure_ascii=False, indent=2)

print(f"\n[輸出完成] 雙北店家資料庫已產出至: {out_file}")
print(f"總筆數: {len(all_stores)} 筆 (涵蓋雙北 22 行政區)")