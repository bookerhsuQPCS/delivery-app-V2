// File: E:\VueProjects\delivery-app-V2\server\app.js
import express from 'express';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 確保 logs 資料夾存在
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'dispatch.log');

// 載入商家資料庫
let STORES_DATABASE = [];
try {
  const storesPath = path.join(__dirname, 'data', 'stores.json');
  if (fs.existsSync(storesPath)) {
    STORES_DATABASE = JSON.parse(fs.readFileSync(storesPath, 'utf-8'));
    console.log(`[Database] 成功載入雙北商家，共 ${STORES_DATABASE.length} 筆`);
  }
} catch (err) {
  console.error('[Database] 讀取 stores.json 失敗:', err.message);
}

// 1. API: 提供店家清單
app.get('/api/restaurants', (req, res) => {
  res.json(STORES_DATABASE);
});

// 雙北核心地址與地標快取字典 (確保 100% 快速解析)
const TW_PRESET_LOCATIONS = {
  // 台北車站周邊
  '台北車站': [25.0478, 121.5170],
  '臺北車站': [25.0478, 121.5170],
  '忠孝西路一段66號': [25.0465, 121.5152],
  '忠孝西路一段': [25.0465, 121.5152],
  '忠孝西路': [25.0465, 121.5152],
  '館前路': [25.0450, 121.5148],
  '新光三越站前': [25.0459, 121.5151],
  '重慶南路一段': [25.0435, 121.5135],
  '重慶南路': [25.0435, 121.5135],
  '市民大道一段': [25.0490, 121.5180],
  // 台北市主要地標與路名
  '台北市政府': [25.0375, 121.5637],
  '台北101': [25.0339, 121.5644],
  '信義威秀': [25.0353, 121.5670],
  '西門町': [25.0422, 121.5081],
  '松山車站': [25.0494, 121.5779],
  '南港車站': [25.0521, 121.6067],
  '忠孝東路四段': [25.0416, 121.5510],
  '信義區': [25.0330, 121.5654],
  '大安區': [25.0264, 121.5435],
  '中正區': [25.0324, 121.5190],
  '中山區': [25.0645, 121.5338],
  '內湖區': [25.0685, 121.5900],
  // 新北市主要地標與路名
  '板橋車站': [25.0142, 121.4637],
  '新北市政府': [25.0124, 121.4657],
  '汐止車站': [25.0682, 121.6620],
  '汐止區': [25.0620, 121.6580],
  '大同路二段': [25.0655, 121.6540],
  '大同路一段': [25.0560, 121.6410],
  '新台五路一段': [25.0601, 121.6515],
  '三重區': [25.0615, 121.4980],
  '中和區': [25.0000, 121.5000],
  '永和區': [25.0100, 121.5150],
  '新莊區': [25.0360, 121.4500]
};

// 2. API: 正向地理編碼 (地址轉經緯度座標 - 字典快取 + OSM 退階)
app.post('/api/geocode', async (req, res) => {
  const { address } = req.body;
  if (!address || typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ success: false, message: '請提供有效的地址' });
  }

  const rawQuery = address.trim();
  console.log(`[Geocode Request] 正在解析: "${rawQuery}"`);

  // 1. 優先比對字典檔
  for (const [key, coords] of Object.entries(TW_PRESET_LOCATIONS)) {
    if (rawQuery.includes(key)) {
      console.log(`[Geocode Match] 字典命中: "${key}" ➔`, coords);
      return res.json({
        success: true,
        coords: coords,
        displayName: `${rawQuery} (雙北定位)`
      });
    }
  }

  // 2. 外部 OpenStreetMap 查詢
  const strippedNumber = rawQuery.replace(/\d+號.*/, '');
  const queriesToTry = [rawQuery, strippedNumber].filter(Boolean);

  for (const q of queriesToTry) {
    try {
      const osmRes = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: q,
          format: 'jsonv2',
          countrycodes: 'tw',
          limit: 1,
          'accept-language': 'zh-TW'
        },
        timeout: 3000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) delivery-dispatch/2.0' }
      });

      if (osmRes.data && osmRes.data.length > 0) {
        const match = osmRes.data[0];
        const lat = parseFloat(match.lat);
        const lng = parseFloat(match.lon);
        console.log(`[Geocode OSM] 查詢成功: "${q}" ➔ [${lat}, ${lng}]`);
        return res.json({
          success: true,
          coords: [lat, lng],
          displayName: match.display_name
        });
      }
    } catch (err) {
      console.warn(`[Geocode OSM] 查詢 "${q}" 失敗:`, err.message);
    }
  }

  // 3. 兜底回傳台北車站預設點，避免中斷
  console.warn(`[Geocode Fallback] 未能完全匹配，使用台北車站預設點`);
  return res.json({
    success: true,
    coords: [25.0478, 121.5170],
    displayName: `${rawQuery} (台北車站中心周邊)`
  });
});

// 3. API: 反向地理編碼 (座標轉門牌地址)
app.post('/api/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing lat or lng' });

  const fLat = parseFloat(lat);
  const fLng = parseFloat(lng);
  let resolvedAddress = `雙北外送點 (${fLat.toFixed(4)}, ${fLng.toFixed(4)})`;

  try {
    const osmRes = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${fLat}&lon=${fLng}&accept-language=zh-TW&addressdetails=1`,
      {
        timeout: 3000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) delivery-dispatch/2.0' }
      }
    );

    if (osmRes.data) {
      const addr = osmRes.data.address || {};
      let city = addr.city || addr.town || addr.county || '台北市';
      let district = addr.suburb || addr.district || addr.borough || '';
      let road = addr.road || addr.pedestrian || addr.highway || addr.street || '';

      let houseNumber = addr.house_number || '';
      if (!houseNumber && osmRes.data.display_name) {
        const m = osmRes.data.display_name.match(/(\d+)號/);
        if (m) houseNumber = m[1];
      }
      if (!houseNumber) {
        const hashSeed = Math.abs(Math.round(fLat * 10000 + fLng * 10000));
        houseNumber = ((hashSeed % 120) + 1).toString();
      }
      if (!houseNumber.endsWith('號')) houseNumber = `${houseNumber}號`;
      if (!road) road = addr.neighbourhood || addr.village || '忠孝西路一段';

      city = city.replace('臺北市', '台北市').replace('臺北縣', '新北市');
      district = district.replace('臺北市', '').replace('新北市', '');

      resolvedAddress = `${city}${district}${road}${houseNumber}`.trim();
    }
  } catch (err) {}

  res.json({ address: resolvedAddress });
});

// 4. API: 外送調度日誌 (記錄標準外送 $49 與稍遠加價 $30)
app.post('/api/dispatch-log', (req, res) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...req.body
  };

  const surchargeStr = logEntry.surcharge > 0 ? `(稍遠加價 +$${logEntry.surcharge})` : '(標準運費)';
  const logLine = `[${logEntry.timestamp}] [${logEntry.orderId}] 騎士:${logEntry.riderName} | 商家:${logEntry.storeName} [${logEntry.storeCategory}] | 直線距離:${logEntry.deliverDistKm}km | 運費:$${logEntry.deliveryFee} ${surchargeStr} | 送往:${logEntry.address}\n`;

  console.log(`[DISPATCH LOG] ${logLine.trim()}`);
  fs.appendFile(logFilePath, logLine, () => {});
  res.json({ status: 'logged' });
});

// ==========================================
// 監控中心：取得特定外送員近 3 天已完成訂單 (僅店家至客戶端軌跡)
// ==========================================
// ==========================================
// 實體訂單庫管理 (server/data/orders.json)
// ==========================================
const ordersJsonPath = path.join(__dirname, 'data', 'orders.json');

function getStoredOrders() {
  try {
    if (!fs.existsSync(ordersJsonPath)) {
      fs.writeFileSync(ordersJsonPath, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(ordersJsonPath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('[Database] 讀取 orders.json 失敗:', err.message);
    return [];
  }
}

function saveStoredOrders(orders) {
  try {
    fs.writeFileSync(ordersJsonPath, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] 寫入 orders.json 失敗:', err.message);
  }
}

// 訂單完成送達時呼叫：寫入/更新完整訂單實體與真實 OSRM 道路軌跡
app.post('/api/orders/complete', (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.orderId) {
    return res.status(400).json({ error: '缺少 orderId 或訂單資料' });
  }

  const orders = getStoredOrders();
  const existingIndex = orders.findIndex(o => o.orderId === orderData.orderId);

  const completedRecord = {
    orderId: orderData.orderId,
    status: '已送達',
    riderName: orderData.riderName || orderData.rider?.name || '未知騎士',
    storeName: orderData.storeName || '',
    storeCategory: orderData.storeCategory || '一般餐飲',
    customerAddress: orderData.customerAddress || orderData.address || '',
    deliveryFee: orderData.deliveryFee || 49,
    surcharge: orderData.surcharge || 0,
    deliverDistKm: orderData.deliverDistKm || '0',
    completedAt: orderData.completedAt || new Date().toISOString(),
    storeCoord: orderData.storeCoord || orderData.restaurant,
    customerCoord: orderData.customerCoord || orderData.customer,
    // 嚴格保存貼齊路網的真實 OSRM 節點陣列
    deliverRouteCoords: orderData.deliverRouteCoords || []
  };

  if (existingIndex !== -1) {
    orders[existingIndex] = completedRecord;
  } else {
    orders.unshift(completedRecord);
  }

  saveStoredOrders(orders);
  console.log(`[Order DB] 訂單 ${orderData.orderId} 已成功落盤保存至 orders.json (共 ${completedRecord.deliverRouteCoords.length} 個道路點)`);
  res.json({ success: true, orderId: orderData.orderId });
});

// 監控中心：取得特定外送員近 3 天已完成訂單 (直接自 orders.json 檢索)
app.get('/api/monitor/rider-history', (req, res) => {
  const { riderName } = req.query;
  if (!riderName) {
    return res.status(400).json({ error: '缺少 riderName 參數' });
  }

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const allOrders = getStoredOrders();

  // 1. 篩選指定外送員、已送達、且在三天內的真實訂單
  const history = allOrders.filter(o => {
    if (o.riderName !== riderName) return false;
    const completedTime = new Date(o.completedAt).getTime();
    return (now - completedTime) <= THREE_DAYS_MS;
  });

  res.json(history);
});

// 讀取外送員清單 API (不用再宣告 fs / path)
app.get('/api/riders', (req, res) => {
  try {
    const ridersPath = path.join(__dirname, 'data', 'riders.json');
    const ridersData = fs.readFileSync(ridersPath, 'utf8');
    res.json(JSON.parse(ridersData));
  } catch (err) {
    console.error('讀取外送員資料失敗:', err);
    res.status(500).json({ error: '無法讀取外送員資料' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

export default app;