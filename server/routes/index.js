// File: server/routes/index.js
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

var DATA_DIR = path.resolve(__dirname, '..', 'data');
var MENUS_FILE = path.join(DATA_DIR, 'menus.json');
var ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function loadJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`[loadJson Error] ${filePath}:`, e);
  }
  return fallback;
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[saveJson Error] ${filePath}:`, e);
  }
}

// 1. 菜單查詢 API
router.get('/api/menu', function(req, res) {
  var storeName = '';
  var rawCat = '';
  try {
    storeName = decodeURIComponent(String(req.query.storeName || ''));
    rawCat = decodeURIComponent(String(req.query.category || ''));
  } catch (e) {
    storeName = String(req.query.storeName || '');
    rawCat = String(req.query.category || '');
  }

  var combinedText = storeName + ' ' + rawCat;
  var menus = loadJson(MENUS_FILE, {});

  let menuType = 'BENTO';
  if (/茶|手搖|咖啡|飲品|冷飲|清心|五十嵐|麻古|迷客夏|可不可|鮮茶|拿鐵|沐睦|商行/i.test(combinedText)) {
    menuType = 'DRINK';
  } else if (/麵|拉麵|牛肉麵|意麵|米粉|水餃|餛飩|烏龍/i.test(combinedText)) {
    menuType = 'NOODLE';
  } else if (/義大利|牛排|美式|漢堡|火鍋|熱炒|酒食|餐酒|鐵板燒|義式|西餐/i.test(combinedText)) {
    menuType = 'RESTAURANT';
  }

  var categoryData = menus[menuType] || menus['BENTO'] || { categoryLabel: '精選餐點', items: [] };

  res.json({
    success: true,
    categoryType: menuType,
    categoryLabel: categoryData.categoryLabel,
    storeName: storeName,
    items: categoryData.items
  });
});

// 2. 訂單完成入帳 API (存入 server/data/orders.json)
router.post('/api/orders/complete', function(req, res) {
  var body = req.body;
  var orders = loadJson(ORDERS_FILE, []);

  var totalBill = Number(body.itemTotal || 0) + Number(body.deliveryFee || 0);
  var record = {
    orderId: body.orderId,
    riderName: body.riderName,
    storeName: body.storeName,
    storeCategory: body.storeCategory,
    customerAddress: body.customerAddress,
    items: body.items || [],
    itemTotal: Number(body.itemTotal || 0),
    deliveryFee: Number(body.deliveryFee || 0),
    totalBill: totalBill,
    surcharge: body.surcharge || 0,
    deliverDistKm: body.deliverDistKm,
    completedAt: body.completedAt || new Date().toISOString(),
    storeCoord: body.storeCoord,
    customerCoord: body.customerCoord
  };

  orders.unshift(record);
  saveJson(ORDERS_FILE, orders);

  console.log(`[Order Completed] 訂單 ${body.orderId} 已持久化入帳至 data/orders.json`);
  res.json({ success: true, order: record });
});

// 3. 查詢歷史訂單
router.get('/api/orders/history', function(req, res) {
  var orders = loadJson(ORDERS_FILE, []);
  res.json(orders);
});

module.exports = router;