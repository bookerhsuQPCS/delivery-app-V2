// File: client/src/utils/geoUtils.js

// 計算兩點球面直線距離 (km)
export function getDistanceKm(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const R = 6371;
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[0] * Math.PI) / 180) *
      Math.cos((coord2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// 產生指定半徑環狀範圍內的隨機經緯度
export function getRandomLocationInRange(center, minKm, maxKm) {
  const [centerLat, centerLng] = center;
  const minDeg = minKm / 111.32;
  const maxDeg = maxKm / 111.32;
  const u = Math.random();
  const radiusInDegrees = Math.sqrt(u * (maxDeg * maxDeg - minDeg * minDeg) + minDeg * minDeg);
  const angle = Math.random() * 2 * Math.PI;
  const deltaLat = radiusInDegrees * Math.cos(angle);
  const deltaLng = (radiusInDegrees * Math.sin(angle)) / Math.cos((centerLat * Math.PI) / 180);
  return [
    parseFloat((centerLat + deltaLat).toFixed(6)),
    parseFloat((centerLng + deltaLng).toFixed(6))
  ];
}

// 計算導航旋轉角 (Bearing)
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// 判斷商家所屬城市：台北市 或 新北市
export function getCityLabel(store) {
  if (!store) return '雙北';
  if (store.city) {
    return store.city.replace('臺北市', '台北市').replace('臺北縣', '新北市');
  }
  if (store.address) {
    if (store.address.includes('新北')) return '新北市';
    if (store.address.includes('台北') || store.address.includes('臺北')) return '台北市';
  }

  const ntpDistricts = [
    '板橋', '三重', '中和', '永和', '新莊', '新店', '土城', '蘆洲', 
    '樹林', '汐止', '鶯歌', '三峽', '淡水', '瑞芳', '五股', '泰山', 
    '林口', '深坑', '石碇', '坪林', '三芝', '石門', '八里', '平溪', 
    '雙溪', '貢寮', '金山', '萬里', '烏來'
  ];

  if (store.district && ntpDistricts.some(d => store.district.includes(d))) {
    return '新北市';
  }
  return '台北市';
}

// 嚴格精確判斷是否為飲料店
export function isDrinkStore(store) {
  if (!store) return false;
  
  const name = (store.name || '').trim();
  const category = (store.category || store.type || '').trim();

  // 1. 常見手搖飲料品牌與關鍵字
  const drinkBrands = [
    '50嵐', '清心', '可不可', '麻古', '迷客夏', '茶湯會', '烏弄', 'CoCo', 'coco',
    '一沐日', '萬波', '得正', '龜記', '五桐號', '約翰紅茶', '珍煮丹', '路易莎',
    '星巴克', 'cama', '大苑子', '再睡5分鐘', '先喝道', 'Comebuy', 'comebuy'
  ];

  if (drinkBrands.some(brand => name.includes(brand))) {
    return true;
  }

  // 2. 明確餐點排除關鍵字（若店名包含麵、火鍋、排骨、飯，一律歸為一般餐飲）
  const foodKeywords = ['麵', '火鍋', '飯', '便當', '小吃', '排骨', '排餐', '早午餐', '漢堡', '水餃', '水產', '海鮮', '熱炒'];
  if (foodKeywords.some(f => name.includes(f))) {
    return false;
  }

  // 3. 類別關鍵字比對
  const drinkKeywords = ['飲料', '手搖', '茶飲', '咖啡', '冰品', '果汁', '豆花'];
  if (drinkKeywords.some(k => category.includes(k))) {
    return true;
  }

  // 預設為一般餐飲
  return false;
}

// 後端 API 基礎路徑
export function getApiBase() {
  return window.location.port === '5173' ? 'http://localhost:3000' : '';
}