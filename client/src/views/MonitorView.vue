<!-- File: client/src/views/MonitorView.vue -->
<template>
  <div class="monitor-container">
    <!-- 左側控制面板：外送員清單與歷史回放明細 -->
    <div class="monitor-sidebar">
      <div class="sidebar-header">
        <div class="header-title">📡 車隊監控與軌跡中心</div>
        <div class="header-sub">即時全域動態 · 3 天內履約回放</div>
      </div>

      <!-- 模式切換鈕 -->
      <div class="tab-controls">
        <button 
          class="tab-btn" 
          :class="{ active: currentMode === 'LIVE' }" 
          @click="switchToLiveMode"
        >
          🟢 即時派送 ({{ activeOrders.length }})
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: currentMode === 'HISTORY' }" 
          @click="currentMode = 'HISTORY'"
        >
          🕒 歷史回放
        </button>
      </div>

      <!-- 外送員列表 -->
      <div class="rider-list-wrap">
        <div class="section-label">外送員名冊 (點選調閱近三天軌跡)</div>
        <div class="rider-cards">
          <div
            v-for="rider in registeredRiders"
            :key="rider.name"
            class="rider-card"
            :class="{ active: selectedRider?.name === rider.name }"
            @click="selectRiderForHistory(rider)"
          >
            <div class="r-avatar">{{ rider.avatar || '🛵' }}</div>
            <div class="r-info">
              <div class="r-name">{{ rider.name }}</div>
              <div class="r-vehicle">{{ rider.vehicle || '機車' }}</div>
            </div>
            <div class="r-status-badge" :class="{ running: isRiderDelivering(rider.name) }">
              {{ isRiderDelivering(rider.name) ? '執勤中' : '待命' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 歷史訂單抽屜 (選中某外送員後展開) -->
      <div class="history-detail-panel" v-if="currentMode === 'HISTORY' && selectedRider">
        <div class="history-title">
          <span>📋 {{ selectedRider.name }} (近 3 天任務)</span>
          <span class="count-tag">{{ historyOrders.length }} 筆</span>
        </div>

        <div v-if="isLoadingHistory" class="loading-box">載入歷史紀錄中...</div>
        <div v-else-if="historyOrders.length === 0" class="empty-box">近 3 天無已完成單據</div>

        <div class="history-list" v-else>
          <div
            v-for="ord in historyOrders"
            :key="ord.orderId"
            class="history-card"
            :class="{ selected: selectedHistoryOrderId === ord.orderId }"
            @click="highlightHistoryRoute(ord)"
          >
            <div class="hc-header">
              <span class="hc-id">{{ ord.orderId }}</span>
              <span class="hc-fee">${{ ord.deliveryFee }}</span>
            </div>
            <div class="hc-store">🏪 {{ ord.storeName }}</div>
            <div class="hc-addr">🏠 {{ ord.customerAddress }}</div>
            <div class="hc-footer">
              <span>配送里程 {{ ord.deliverDistKm }} km</span>
              <span>{{ formatTime(ord.completedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右側全螢幕監控地圖 -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-view"></div>

      <!-- 頂部資訊狀態列 -->
      <div class="monitor-hud-status">
        <span v-if="currentMode === 'LIVE'">
          🟢 即時全域監控中：外送軌跡行駛中 (送達後閃爍 3.5 秒自動清除)
        </span>
        <span v-else>
          🕒 歷史回放：【{{ selectedRider?.name || '請選擇外送員' }}】僅顯示店家 ➔ 客戶端之配送軌跡 (滑鼠懸停圖示查看名稱)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';
import { getApiBase } from '@/utils/geoUtils';

const mapContainer = ref(null);
let map = null, ws = null, broadcastChannel = null;

const currentMode = ref('LIVE'); // 'LIVE' | 'HISTORY'
const registeredRiders = ref([]);
const selectedRider = ref(null);

const activeOrders = reactive([]);
const liveOrderLayers = new Map();

const historyOrders = ref([]);
const isLoadingHistory = ref(false);
const selectedHistoryOrderId = ref(null);
let historyRouteLayers = [];

// 取得外送員清單
async function loadRiders() {
  try {
    const res = await fetch(`${getApiBase()}/api/riders`);
    if (res.ok) {
      registeredRiders.value = await res.json();
    }
  } catch (e) {
    console.error('載入外送員名冊失敗', e);
  }
}

function isRiderDelivering(name) {
  return activeOrders.some(o => o.rider?.name === name && o.status !== '已送達');
}

// 建立精緻小圖示標記，文字資訊收納於 Tooltip
function createHistoryEndpointMarker(coord, type, label) {
  const isStore = type === 'STORE';
  const icon = L.divIcon({
    className: 'history-endpoint-pin',
    html: `
      <div class="h-endpoint-badge ${isStore ? 'store-badge' : 'client-badge'}">
        <span>${isStore ? '🏪' : '🏠'}</span>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  const marker = L.marker(coord, { icon, zIndexOffset: isStore ? 600 : 650 });
  const prefix = isStore ? '🏪 店家' : '🏠 客戶';
  marker.bindTooltip(`<strong>${prefix}</strong>：${label}`, {
    direction: 'top',
    offset: [0, -10],
    className: 'custom-map-tooltip'
  });
  return marker;
}

// 點選外送員查核三天歷史
async function selectRiderForHistory(rider) {
  selectedRider.value = rider;
  currentMode.value = 'HISTORY';
  clearLiveLayersFromMap();
  clearHistoryLayers();

  isLoadingHistory.value = true;
  try {
    const res = await fetch(`${getApiBase()}/api/monitor/rider-history?riderName=${encodeURIComponent(rider.name)}`);
    if (res.ok) {
      historyOrders.value = await res.json();
      renderAllHistoryRoutes(historyOrders.value);
    }
  } catch (e) {
    console.error('載入歷史失敗', e);
  } finally {
    isLoadingHistory.value = false;
  }
}

function switchToLiveMode() {
  currentMode.value = 'LIVE';
  selectedHistoryOrderId.value = null;
  clearHistoryLayers();
  restoreLiveLayersToMap();
}

// 繪製三天內所有路線：採用真實 OSRM 路網 (deliverRouteCoords)
function renderAllHistoryRoutes(orders) {
  clearHistoryLayers();
  if (!orders || orders.length === 0) return;

  const allPoints = [];
  orders.forEach((ord, idx) => {
    const coords = ord.deliverRouteCoords || ord.trackCoords || [];
    if (!coords || coords.length === 0) return;

    const color = ['#0284c7', '#2563eb', '#4f46e5'][idx % 3];
    
    // 真實道路線條：實線清晰呈現
    const poly = L.polyline(coords, {
      color,
      weight: 4,
      opacity: 0.8
    }).addTo(map);

    const startMarker = createHistoryEndpointMarker(ord.storeCoord, 'STORE', ord.storeName).addTo(map);
    const endMarker = createHistoryEndpointMarker(ord.customerCoord, 'CLIENT', ord.customerAddress).addTo(map);

    historyRouteLayers.push(poly, startMarker, endMarker);
    allPoints.push(...coords);
  });

  if (allPoints.length > 0) {
    map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60] });
  }
}

// 點擊聚焦單筆歷史單：翡翠綠高亮路線
function highlightHistoryRoute(ord) {
  selectedHistoryOrderId.value = ord.orderId;
  clearHistoryLayers();

  const coords = ord.deliverRouteCoords || ord.trackCoords || [];
  if (!coords || coords.length === 0) return;

  const mainPoly = L.polyline(coords, {
    color: '#10b981',
    weight: 6,
    opacity: 0.95
  }).addTo(map);

  const startMarker = createHistoryEndpointMarker(ord.storeCoord, 'STORE', ord.storeName).addTo(map);
  const endMarker = createHistoryEndpointMarker(ord.customerCoord, 'CLIENT', ord.customerAddress).addTo(map);

  historyRouteLayers.push(mainPoly, startMarker, endMarker);
  map.fitBounds(mainPoly.getBounds(), { padding: [90, 90] });
}

function clearHistoryLayers() {
  historyRouteLayers.forEach(l => {
    if (map && map.hasLayer(l)) map.removeLayer(l);
  });
  historyRouteLayers = [];
}

// === 即時全域派送與送達閃爍清除 ===

function handleLiveDispatch(ord) {
  if (activeOrders.some(o => o.orderId === ord.orderId)) return;
  activeOrders.unshift(ord);

  const traveledPolyline = L.polyline([], {
    color: ord.color || '#06C167',
    weight: 5,
    opacity: 0.9
  });

  const fullPlannedPolyline = L.polyline(ord.routeCoords || [], {
    color: ord.color || '#06C167',
    weight: 3,
    dashArray: '4, 6',
    opacity: 0.35
  });

  const riderMarker = L.marker(ord.riderOrigin, {
    icon: L.divIcon({
      className: 'live-monitor-rider',
      html: `<div id="mon-nav-${ord.orderId}" class="m-rider-bubble" style="border-color:${ord.color}">🛵 ${ord.rider?.name}</div>`,
      iconSize: [80, 26],
      iconAnchor: [40, 13]
    }),
    zIndexOffset: 800
  });

  const layerItem = {
    orderId: ord.orderId,
    traveledPolyline,
    fullPlannedPolyline,
    riderMarker,
    traveledCoords: []
  };

  liveOrderLayers.set(ord.orderId, layerItem);

  if (currentMode.value === 'LIVE') {
    fullPlannedPolyline.addTo(map);
    traveledPolyline.addTo(map);
    riderMarker.addTo(map);
  }
}

function handleLiveLocationUpdate(data) {
  const item = liveOrderLayers.get(data.orderId);
  if (!item) return;

  if (data.lat !== undefined && data.lng !== undefined) {
    const curCoord = [data.lat, data.lng];
    item.traveledCoords.push(curCoord);
    item.traveledPolyline.setLatLngs(item.traveledCoords);
    item.riderMarker.setLatLng(curCoord);
  }

  // 送達事件：觸發閃爍 3.5 秒後清除
  if (data.status === '已送達' || data.stage === 'DELIVERED') {
    triggerFlashAndRemove(data.orderId);
  }
}

function triggerFlashAndRemove(orderId) {
  const item = liveOrderLayers.get(orderId);
  if (!item) return;

  const el = document.getElementById(`mon-nav-${orderId}`);
  if (el) {
    el.innerHTML = `🎉 已送達`;
    el.classList.add('flash-complete-glow');
  }

  if (item.traveledPolyline._path) {
    item.traveledPolyline._path.classList.add('track-flashing-line');
  }

  // 等候 3.5 秒閃爍後徹底清除圖層
  setTimeout(() => {
    if (map) {
      if (item.traveledPolyline && map.hasLayer(item.traveledPolyline)) map.removeLayer(item.traveledPolyline);
      if (item.fullPlannedPolyline && map.hasLayer(item.fullPlannedPolyline)) map.removeLayer(item.fullPlannedPolyline);
      if (item.riderMarker && map.hasLayer(item.riderMarker)) map.removeLayer(item.riderMarker);
    }
    liveOrderLayers.delete(orderId);

    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx !== -1) activeOrders.splice(idx, 1);
  }, 3500);
}

function clearLiveLayersFromMap() {
  liveOrderLayers.forEach(l => {
    if (map) {
      if (map.hasLayer(l.traveledPolyline)) map.removeLayer(l.traveledPolyline);
      if (map.hasLayer(l.fullPlannedPolyline)) map.removeLayer(l.fullPlannedPolyline);
      if (map.hasLayer(l.riderMarker)) map.removeLayer(l.riderMarker);
    }
  });
}

function restoreLiveLayersToMap() {
  liveOrderLayers.forEach(l => {
    if (map) {
      l.fullPlannedPolyline.addTo(map);
      l.traveledPolyline.addTo(map);
      l.riderMarker.addTo(map);
    }
  });
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

onMounted(async () => {
  await loadRiders();

  map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false }).setView([25.0475, 121.5170], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  try {
    broadcastChannel = new BroadcastChannel('delivery_dispatch_channel');
    broadcastChannel.onmessage = (e) => processIncoming(e.data);
  } catch (e) {}

  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? `${window.location.hostname}:3000` : window.location.host;
    ws = new WebSocket(`${wsProtocol}//${host}`);
    ws.onmessage = (e) => {
      try { processIncoming(JSON.parse(e.data)); } catch (err) {}
    };
  } catch (e) {}
});

function processIncoming(data) {
  if (data.type === 'DISPATCH_NEW' || data.type === 'ORDER_DISPATCHED') {
    handleLiveDispatch(data.order);
  }
  if (data.type === 'ORDER_LOCATION_UPDATE') {
    handleLiveLocationUpdate(data);
  }
}

onUnmounted(() => {
  if (ws) ws.close();
  if (broadcastChannel) broadcastChannel.close();
  clearHistoryLayers();
  clearLiveLayersFromMap();
  if (map) map.remove();
});
</script>

<style scoped>
.monitor-container { display: flex; width: 100vw; height: 100vh; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; }
.monitor-sidebar { width: 340px; height: 100%; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; z-index: 10; color: #fff; }
.sidebar-header { padding: 16px; border-bottom: 1px solid #334155; }
.header-title { font-size: 16px; font-weight: 900; color: #38bdf8; }
.header-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }

.tab-controls { display: flex; padding: 10px 14px; gap: 8px; border-bottom: 1px solid #334155; }
.tab-btn { flex: 1; border: none; background: #0f172a; color: #94a3b8; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
.tab-btn.active { background: #0284c7; color: #fff; }

.rider-list-wrap { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.section-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
.rider-cards { display: flex; flex-direction: column; gap: 6px; }
.rider-card { display: flex; align-items: center; gap: 10px; background: #0f172a; padding: 10px 12px; border-radius: 10px; border: 1.5px solid transparent; cursor: pointer; transition: all 0.2s; }
.rider-card.active { border-color: #38bdf8; background: #1e3a5f; }
.r-avatar { font-size: 20px; }
.r-info { flex: 1; }
.r-name { font-size: 13px; font-weight: 800; }
.r-vehicle { font-size: 10px; color: #94a3b8; }
.r-status-badge { font-size: 10px; padding: 2px 6px; border-radius: 6px; background: #334155; color: #94a3b8; font-weight: 700; }
.r-status-badge.running { background: #065f46; color: #34d399; }

.history-detail-panel { flex: 1.2; border-top: 1px solid #334155; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #111827; overflow-y: auto; }
.history-title { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 4px; }
.count-tag { font-size: 10px; background: #374151; padding: 1px 6px; border-radius: 8px; }
.loading-box, .empty-box { font-size: 12px; color: #94a3b8; text-align: center; padding: 16px; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-card { background: #1f2937; padding: 10px; border-radius: 8px; border: 1px solid #374151; cursor: pointer; font-size: 11px; transition: all 0.2s; }
.history-card.selected { border-color: #10b981; background: #064e3b; }
.hc-header { display: flex; justify-content: space-between; font-weight: 800; color: #e5e7eb; }
.hc-fee { color: #10b981; }
.hc-store { margin-top: 4px; color: #93c5fd; }
.hc-addr { color: #cbd5e1; }
.hc-footer { display: flex; justify-content: space-between; margin-top: 6px; color: #6b7280; font-size: 10px; border-top: 1px dashed #374151; padding-top: 4px; }

.map-wrapper { flex: 1; height: 100%; position: relative; }
.map-view { width: 100%; height: 100%; }

.monitor-hud-status { position: absolute; top: 14px; left: 14px; z-index: 1000; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4); }

/* 送達時閃爍動畫 */
:deep(.m-rider-bubble) { background: #0f172a; color: #ffffff; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 2px solid #007AFF; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4); white-space: nowrap; }
:deep(.flash-complete-glow) { animation: flashGlow 0.5s infinite alternate; background: #ef4444 !important; border-color: #ffffff !important; }
@keyframes flashGlow { from { opacity: 0.3; transform: scale(0.9); } to { opacity: 1; transform: scale(1.1); } }

:deep(.track-flashing-line) { animation: pathFlash 0.5s infinite alternate; stroke: #ef4444 !important; }
@keyframes pathFlash { from { stroke-opacity: 0.2; stroke-width: 3; } to { stroke-opacity: 1; stroke-width: 7; } }

/* 歷史端點圓形小圖示 (Pin Badge) */
:deep(.history-endpoint-pin) {
  pointer-events: auto;
}
:deep(.h-endpoint-badge) {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border: 2px solid #ffffff;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
:deep(.h-endpoint-badge:hover) {
  transform: scale(1.22);
}
:deep(.h-endpoint-badge.store-badge) {
  background: #0284c7;
}
:deep(.h-endpoint-badge.client-badge) {
  background: #ef4444;
}

/* Tooltip 浮動提示框 */
:deep(.custom-map-tooltip) {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
:deep(.custom-map-tooltip::before) {
  border-top-color: rgba(15, 23, 42, 0.95);
}
</style>