<!-- File: client/src/views/MobileDriverView.vue -->
<template>
  <div class="mobile-driver-container">
    <!-- 底層全螢幕地圖 -->
    <div ref="mapContainer" class="map-view"></div>

    <!-- 頂部身分切換條 -->
    <div class="identity-trigger-bar" @click="isPickerOpen = true">
      <div class="identity-left">
        <div class="rider-avatar-bubble">{{ currentRiderProfile?.avatar || '🛵' }}</div>
        <div class="rider-text-info">
          <div class="rider-name-row">
            <span class="rider-main-name">{{ currentRiderProfile?.name || '載入中...' }}</span>
            <span class="rider-tag">當前執勤身分</span>
          </div>
          <div class="rider-vehicle-sub">{{ currentRiderProfile?.vehicle }} · 評分 {{ currentRiderProfile?.rating }}★</div>
        </div>
      </div>
      <div class="identity-right">
        <span class="switch-hint">切換名單</span>
        <span class="arrow-icon">❯</span>
      </div>
    </div>

    <!-- 頂部 Turn-by-Turn 轉向導航看板 (雙段自適應) -->
    <div class="nav-hud-turn" v-if="currentOrder">
      <div class="turn-action-box" :class="navGuidance.type">
        <span class="turn-arrow-symbol">{{ navGuidance.symbol }}</span>
      </div>

      <div class="turn-text-box">
        <div class="turn-stage-pill" :class="getStagePillClass(currentOrder.stage)">
          {{ getStagePillText(currentOrder) }}
        </div>
        <div class="turn-command">{{ navGuidance.instruction }}</div>
        <div class="turn-subtext">
          目標：<b>{{ (currentOrder.stage === 'PICKING_UP' || currentOrder.stage === 'WAITING_MEAL') ? currentOrder.storeName : currentOrder.address }}</b>
        </div>
      </div>

      <div class="turn-metrics-box">
        <div class="metric-eta">{{ currentOrder.eta }}<span class="unit">分</span></div>
        <div class="metric-dist">
          {{ (currentOrder.stage === 'PICKING_UP' || currentOrder.stage === 'WAITING_MEAL') ? `${currentOrder.pickupDistKm || '0'} km` : `${currentOrder.deliverDistKm || currentOrder.totalDistanceKm} km` }}
        </div>
      </div>
    </div>

    <!-- 待機狀態看板 -->
    <div class="mobile-idle-hud" v-else>
      <div class="idle-title">🟢 外送員：{{ currentRiderProfile?.name }} (線上待命中)</div>
      <div class="idle-desc">商家周圍 5 分鐘路程候選配對中，後台派單指派後將自動啟動 Turn-by-Turn 導航</div>
    </div>

    <!-- 懸浮視角控制 -->
    <div class="view-controls" v-if="currentOrder">
      <button
        class="ctrl-btn"
        :class="{ active: isAutoFollow }"
        @click="isAutoFollow = !isAutoFollow"
      >
        {{ isAutoFollow ? '🎯 鏡頭鎖定' : '🔓 自由平移' }}
      </button>
      <button class="ctrl-btn reset-btn" @click="fitCurrentRoute">
        🗺️ 雙段全覽
      </button>
    </div>

    <!-- 底部滑動任務抽屜 (Mobile Bottom Sheet) -->
    <div class="mobile-sheet" :class="{ expanded: isSheetExpanded }">
      <div class="sheet-handle-bar" @click="isSheetExpanded = !isSheetExpanded">
        <div class="handle-pill"></div>
        <div class="sheet-title-row">
          <span>📋 【{{ activeRiderName }}】調度任務 ({{ myOrders.length }})</span>
          <span class="sheet-toggle-text">{{ isSheetExpanded ? '收合 ▼' : '展開 ▲' }}</span>
        </div>
      </div>

      <div class="sheet-content">
        <div v-if="myOrders.length === 0" class="empty-state">
          <div class="empty-icon">🛵</div>
          <p>【{{ activeRiderName }}】目前尚無被指派的雙段訂單</p>
          <button class="empty-switch-btn" @click="isPickerOpen = true">切換其他外送員</button>
        </div>

        <div
          v-for="order in myOrders"
          :key="order.orderId"
          class="mobile-card"
          :class="{ active: selectedOrderId === order.orderId, finished: order.status === '已送達' }"
          @click="selectAndFocusOrder(order.orderId)"
        >
          <div class="card-header">
            <span class="card-order-id">{{ order.orderId }} · {{ order.storeName }}</span>
            <span class="card-badge" :class="getOrderBadgeClass(order.status)">
              {{ order.status }}
            </span>
          </div>

          <div class="two-phase-bar">
            <div class="phase-step" :class="{ current: order.stage === 'PICKING_UP' || order.status === '前往取餐中' }">
              <span class="phase-dot">1</span>
              <span>前往取餐 ({{ order.pickupDistKm || '0' }}km)</span>
            </div>
            <div class="phase-arrow">➔</div>
            <div class="phase-step" :class="{ current: order.stage === 'DELIVERING' || order.status === '外送配送中' }">
              <span class="phase-dot">2</span>
              <span>送餐到府 ({{ order.deliverDistKm || '0' }}km)</span>
            </div>
          </div>

          <div class="card-route-preview">
            <div class="route-item">🏪 {{ order.storeName }}</div>
            <div class="route-arrow">↓ 雙段全程 {{ order.totalDistanceKm }} km</div>
            <div class="route-item bold">🏠 {{ order.address }}</div>
          </div>

          <div class="card-footer">
            <span v-if="order.status !== '已送達'" class="eta-text">
              預計剩餘 <b>{{ order.eta }}</b> 分鐘抵達 · 運費 ${{ order.deliveryFee }}
            </span>
            <span v-else class="done-text">🎉 配送完成</span>
            <button class="mini-nav-btn" @click.stop="focusAndFollow(order.orderId)">
              鎖定導航 ↗
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 外送員身分切換 Modal -->
    <div class="picker-overlay" v-if="isPickerOpen" @click="isPickerOpen = false">
      <div class="picker-sheet" @click.stop>
        <div class="picker-header">
          <span class="picker-title">🛵 選擇外送員身分</span>
          <button class="picker-close" @click="isPickerOpen = false">✕</button>
        </div>

        <div class="picker-list">
          <div
            v-for="rider in registeredRiders"
            :key="rider.name"
            class="picker-item"
            :class="{ active: activeRiderName === rider.name }"
            @click="chooseRider(rider.name)"
          >
            <div class="item-left">
              <span class="item-avatar">{{ rider.avatar }}</span>
              <div class="item-details">
                <div class="item-name">{{ rider.name }}</div>
                <div class="item-vehicle">{{ rider.vehicle }} · 評分 {{ rider.rating }}★</div>
              </div>
            </div>
            <div class="item-right">
              <span class="order-count-chip" :class="{ hasOrders: getRiderOrderCount(rider.name) > 0 }">
                {{ getRiderOrderCount(rider.name) }} 筆任務
              </span>
              <span class="check-icon" v-if="activeRiderName === rider.name">✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import L from 'leaflet';
import { calculateTurnGuidance, getStagePillClass, getStagePillText, getOrderBadgeClass } from '@/utils/navigationUtils';
import { getApiBase } from '@/utils/geoUtils';

const route = useRoute();
const mapContainer = ref(null);
const selectedOrderId = ref(null);
const isSheetExpanded = ref(false);
const isAutoFollow = ref(true);
const isPickerOpen = ref(false);
const allOrders = reactive([]);

// 從後端讀取外送員清單庫
const registeredRiders = ref([]);
const activeRiderName = ref(route.query.rider || '陳小豪');

const navGuidance = reactive({
  symbol: '⬆',
  instruction: '沿當前道路直行前往取餐門市',
  type: 'straight'
});

let map = null;
let broadcastChannel = null;
let ws = null;
const orderLayers = new Map();

const currentRiderProfile = computed(() => {
  if (registeredRiders.value.length === 0) {
    return { name: activeRiderName.value, avatar: '🛵', vehicle: '', rating: '5.0' };
  }
  return registeredRiders.value.find(r => r.name === activeRiderName.value) || registeredRiders.value[0];
});

const myOrders = computed(() => {
  return allOrders.filter(o => o.rider?.name === activeRiderName.value);
});

const currentOrder = computed(() => {
  return myOrders.value.find(o => o.orderId === selectedOrderId.value) || myOrders.value[0] || null;
});

function getRiderOrderCount(name) {
  return allOrders.filter(o => o.rider?.name === name).length;
}

// 讀取後端外送員清單
async function loadRidersFromBackend() {
  try {
    const res = await fetch(`${getApiBase()}/api/riders`);
    if (res.ok) {
      registeredRiders.value = await res.json();
      if (!route.query.rider && registeredRiders.value.length > 0) {
        activeRiderName.value = registeredRiders.value[0].name;
      }
    }
  } catch (err) {
    console.error('無法讀取外送員清單:', err);
  }
}

onMounted(async () => {
  await loadRidersFromBackend();

  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false
  }).setView([25.0475, 121.5170], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  map.on('dragstart', () => {
    isAutoFollow.value = false;
  });

  initRealtimeSync();
});

function initRealtimeSync() {
  try {
    broadcastChannel = new BroadcastChannel('delivery_dispatch_channel');
    broadcastChannel.onmessage = (event) => handleIncomingMessage(event.data);
  } catch (e) {}

  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173'
      ? `${window.location.hostname}:3000`
      : window.location.host;

    ws = new WebSocket(`${wsProtocol}//${host}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
      } catch (err) {}
    };
  } catch (err) {}
}

function createRiderIcon(orderId, color) {
  return L.divIcon({
    className: 'custom-rider-icon',
    html: `
      <div id="rider-mobile-nav-${orderId}" class="rider-nav-arrow">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <polygon points="12 2, 19 21, 12 17, 5 21" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

function setupOrderLayers(ord) {
  if (orderLayers.has(ord.orderId)) return;

  const startPoint = ord.riderOrigin || ord.restaurant;
  const marker = L.marker(startPoint, {
    icon: createRiderIcon(ord.orderId, ord.color),
    zIndexOffset: 1000
  });

  const storeIcon = L.divIcon({
    className: 'pin',
    html: `<div class="pin-bubble" style="background:${ord.color}">🏪</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const userIcon = L.divIcon({
    className: 'pin',
    html: `<div class="pin-bubble dest-bubble" style="background:${ord.color}">🏠</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const sMarker = L.marker(ord.restaurant, { icon: storeIcon });
  const uMarker = L.marker(ord.customer, { icon: userIcon });

  const pickupPolyline = L.polyline(ord.pickupRouteCoords || [], {
    color: '#007AFF',
    weight: 6,
    dashArray: '5, 8',
    opacity: 0.9
  });

  const deliverPolyline = L.polyline(ord.deliverRouteCoords || ord.routeCoords || [], {
    color: ord.color,
    weight: 7,
    opacity: 0.95
  });

  const traveledPolyline = L.polyline([], {
    color: '#64748b',
    weight: 6,
    opacity: 0.8
  });

  const layerObj = {
    riderMarker: marker,
    pickupPolyline,
    deliverPolyline,
    traveledPolyline,
    storeMarker: sMarker,
    userMarker: uMarker,
    ord,
    riderName: ord.rider?.name
  };

  orderLayers.set(ord.orderId, layerObj);

  if (layerObj.riderName === activeRiderName.value) {
    addLayerToMap(layerObj);
  }
}

function removeLayerFromMap(layer) {
  if (layer.riderMarker && map.hasLayer(layer.riderMarker)) map.removeLayer(layer.riderMarker);
  if (layer.pickupPolyline && map.hasLayer(layer.pickupPolyline)) map.removeLayer(layer.pickupPolyline);
  if (layer.deliverPolyline && map.hasLayer(layer.deliverPolyline)) map.removeLayer(layer.deliverPolyline);
  if (layer.traveledPolyline && map.hasLayer(layer.traveledPolyline)) map.removeLayer(layer.traveledPolyline);
  if (layer.storeMarker && map.hasLayer(layer.storeMarker)) map.removeLayer(layer.storeMarker);
  if (layer.userMarker && map.hasLayer(layer.userMarker)) map.removeLayer(layer.userMarker);
}

function addLayerToMap(layer) {
  if (layer.pickupPolyline && !map.hasLayer(layer.pickupPolyline)) map.addLayer(layer.pickupPolyline);
  if (layer.deliverPolyline && !map.hasLayer(layer.deliverPolyline)) map.addLayer(layer.deliverPolyline);
  if (layer.traveledPolyline && !map.hasLayer(layer.traveledPolyline)) map.addLayer(layer.traveledPolyline);
  if (layer.storeMarker && !map.hasLayer(layer.storeMarker)) map.addLayer(layer.storeMarker);
  if (layer.userMarker && !map.hasLayer(layer.userMarker)) map.addLayer(layer.userMarker);
  if (layer.riderMarker && !map.hasLayer(layer.riderMarker)) map.addLayer(layer.riderMarker);
}

function syncSingleRiderLayers() {
  orderLayers.forEach((layer) => {
    if (layer.riderName === activeRiderName.value) {
      addLayerToMap(layer);
    } else {
      removeLayerFromMap(layer);
    }
  });
}

function chooseRider(name) {
  activeRiderName.value = name;
  isPickerOpen.value = false;
  syncSingleRiderLayers();

  if (myOrders.value.length > 0) {
    selectedOrderId.value = myOrders.value[0].orderId;
    focusAndFollow(selectedOrderId.value);
  } else {
    selectedOrderId.value = null;
  }
}

function selectAndFocusOrder(orderId) {
  selectedOrderId.value = orderId;
  focusAndFollow(orderId);
}

function focusAndFollow(orderId) {
  selectedOrderId.value = orderId;
  isAutoFollow.value = true;
  const layer = orderLayers.get(orderId);
  if (layer && layer.riderMarker) {
    map.setView(layer.riderMarker.getLatLng(), 16, { animate: true });
  }
}

function fitCurrentRoute() {
  const targetId = currentOrder.value?.orderId;
  if (!targetId) return;
  const layer = orderLayers.get(targetId);
  if (layer) {
    isAutoFollow.value = false;
    const bounds = L.latLngBounds([]);
    if (layer.pickupPolyline && layer.pickupPolyline.getLatLngs().length > 0) {
      bounds.extend(layer.pickupPolyline.getBounds());
    }
    if (layer.deliverPolyline && layer.deliverPolyline.getLatLngs().length > 0) {
      bounds.extend(layer.deliverPolyline.getBounds());
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        paddingBottomRight: [20, 200],
        paddingTopLeft: [20, 210]
      });
    }
  }
}

function handleIncomingMessage(data) {
  if (data.type === 'INIT_ORDERS') {
    allOrders.splice(0, allOrders.length, ...data.orders);
    allOrders.forEach(ord => setupOrderLayers(ord));
    syncSingleRiderLayers();
    if (myOrders.value.length > 0 && !selectedOrderId.value) {
      selectedOrderId.value = myOrders.value[0].orderId;
    }
  }

  if (data.type === 'ORDER_DISPATCHED' || data.type === 'DISPATCH_NEW') {
    const ord = data.order;
    if (!allOrders.find(o => o.orderId === ord.orderId)) {
      allOrders.unshift(ord);
      setupOrderLayers(ord);
      syncSingleRiderLayers();

      if (ord.rider?.name === activeRiderName.value) {
        selectedOrderId.value = ord.orderId;
        isAutoFollow.value = true;
        fitCurrentRoute();
      }
    }
  }

  if (data.type === 'ORDER_LOCATION_UPDATE') {
    const item = allOrders.find(o => o.orderId === data.orderId);
    if (item) {
      item.status = data.status;
      item.eta = data.eta;
      if (data.stage) item.stage = data.stage;
      if (data.prepRemainingMin !== undefined) item.prepRemainingMin = data.prepRemainingMin;
      if (data.prepTotalMin !== undefined) item.prepTotalMin = data.prepTotalMin;
      if (data.departAtMin !== undefined) item.departAtMin = data.departAtMin;
      if (data.elapsedSimMin !== undefined) item.elapsedSimMin = data.elapsedSimMin;
    }

    const layer = orderLayers.get(data.orderId);
    if (layer) {
      if (data.bearing !== undefined) {
        const navEl = document.getElementById(`rider-mobile-nav-${data.orderId}`);
        if (navEl) navEl.style.transform = `rotate(${data.bearing}deg)`;
      }
      if (data.lat !== undefined && data.lng !== undefined) {
        layer.riderMarker.setLatLng([data.lat, data.lng]);
      }

      if (currentOrder.value && currentOrder.value.orderId === data.orderId) {
        const isPickup = (data.stage || item?.stage) === 'PICKING_UP';
        const activeCoords = isPickup ? (layer.ord.pickupRouteCoords || []) : (layer.ord.deliverRouteCoords || []);
        
        if (data.step !== undefined) {
          Object.assign(navGuidance, calculateTurnGuidance(activeCoords, data.step, isPickup));
        }
        if (isAutoFollow.value && data.lat !== undefined && data.lng !== undefined) {
          map.panTo([data.lat, data.lng], { animate: true, duration: 0.8 });
        }
      }

      if (data.status === '已送達' && layer.userMarker) {
        const deliveredIcon = L.divIcon({
          className: 'pin',
          html: `<div class="pin-bubble delivered-bubble">🎉</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        layer.userMarker.setIcon(deliveredIcon);
      }
    }
  }

  if (data.type === 'ORDERS_CLEARED') {
    (data.orderIds || []).forEach((id) => {
      const layer = orderLayers.get(id);
      if (layer) {
        removeLayerFromMap(layer);
        orderLayers.delete(id);
      }
    });

    for (let i = allOrders.length - 1; i >= 0; i--) {
      if ((data.orderIds || []).includes(allOrders[i].orderId)) {
        allOrders.splice(i, 1);
      }
    }
    if ((data.orderIds || []).includes(selectedOrderId.value)) {
      selectedOrderId.value = myOrders.value.length > 0 ? myOrders.value[0].orderId : null;
    }
  }
}

onUnmounted(() => {
  if (broadcastChannel) broadcastChannel.close();
  if (ws) ws.close();
  if (map) map.remove();
});
</script>

<style scoped>
.mobile-driver-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.map-view {
  width: 100%;
  height: 100%;
}

/* 頂部身分切換條 */
.identity-trigger-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1050;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.identity-left { display: flex; align-items: center; gap: 10px; }
.rider-avatar-bubble { width: 36px; height: 36px; background: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1.5px solid #007AFF; }
.rider-text-info { display: flex; flex-direction: column; }
.rider-name-row { display: flex; align-items: center; gap: 6px; }
.rider-main-name { font-size: 14px; font-weight: 900; color: #ffffff; }
.rider-tag { font-size: 10px; background: #007AFF; color: #ffffff; padding: 1px 5px; border-radius: 6px; font-weight: 700; }
.rider-vehicle-sub { font-size: 11px; color: #94a3b8; }
.identity-right { display: flex; align-items: center; gap: 4px; color: #38bdf8; font-size: 12px; font-weight: 700; }

/* 導航看板 */
.nav-hud-turn {
  position: absolute;
  top: 72px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  background: #0f172a;
  border-radius: 20px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  color: #fff;
}

.turn-action-box {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 900;
  flex-shrink: 0;
  background: #1e293b;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.turn-action-box.straight { background: #007AFF; }
.turn-action-box.turn-left, .turn-action-box.slight-left { background: #10b981; }
.turn-action-box.turn-right, .turn-action-box.slight-right { background: #f59e0b; }
.turn-action-box.uturn { background: #8b5cf6; }
.turn-action-box.arrived { background: #ef4444; }

.turn-text-box { flex: 1; overflow: hidden; }
.turn-stage-pill { display: inline-block; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 2px; }
.stage-standby { background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
.stage-pickup { background: rgba(0, 122, 255, 0.25); color: #38bdf8; border: 1px solid rgba(0, 122, 255, 0.4); }
.stage-waiting { background: rgba(234, 88, 12, 0.25); color: #fb923c; border: 1px solid rgba(234, 88, 12, 0.4); }
.stage-deliver { background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
.stage-delivered { background: rgba(148, 163, 184, 0.25); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); }

.turn-command { font-size: 15px; font-weight: 900; color: #ffffff; }
.turn-subtext { font-size: 11px; color: #94a3b8; margin-top: 3px; }
.turn-metrics-box { text-align: right; border-left: 1px solid rgba(255, 255, 255, 0.15); padding-left: 12px; }
.metric-eta { font-size: 24px; font-weight: 900; color: #10b981; line-height: 1; }
.metric-eta .unit { font-size: 11px; margin-left: 2px; }
.metric-dist { font-size: 11px; color: #94a3b8; margin-top: 2px; font-weight: 700; }

.mobile-idle-hud {
  position: absolute;
  top: 72px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 14px 16px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.idle-title { font-size: 14px; font-weight: 800; color: #10b981; }
.idle-desc { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.view-controls {
  position: absolute;
  top: 175px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ctrl-btn { border: none; background: rgba(15, 23, 42, 0.88); color: #fff; padding: 8px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; }
.ctrl-btn.active { background: #10b981; }

/* 底部滑動任務抽屜 */
.mobile-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #ffffff;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.25);
  transition: max-height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  max-height: 180px;
  display: flex;
  flex-direction: column;
}
.mobile-sheet.expanded { max-height: 70vh; }
.sheet-handle-bar { padding: 10px 16px; cursor: pointer; }
.handle-pill { width: 44px; height: 5px; background: #cbd5e1; border-radius: 3px; margin: 0 auto 8px; }
.sheet-title-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; color: #0f172a; }
.sheet-toggle-text { font-size: 12px; color: #007AFF; }
.sheet-content { padding: 0 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }

.empty-state { text-align: center; padding: 20px 0; color: #94a3b8; }
.empty-icon { font-size: 32px; margin-bottom: 4px; }
.empty-switch-btn { margin-top: 8px; border: none; background: #007AFF; color: #ffffff; padding: 6px 14px; border-radius: 14px; font-size: 12px; font-weight: 700; cursor: pointer; }

.mobile-card { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; cursor: pointer; }
.mobile-card.active { border-color: #10b981; background: #f0fdf4; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.card-order-id { font-size: 13px; font-weight: 800; color: #0f172a; }
.card-badge { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
.card-badge.pickup { color: #0284c7; background: #e0f2fe; }
.card-badge.delivering { color: #15803d; background: #dcfce7; }
.card-badge.done { color: #ef4444; background: #fee2e2; }

.two-phase-bar { display: flex; align-items: center; gap: 6px; margin: 6px 0; padding: 4px 8px; background: #f1f5f9; border-radius: 8px; font-size: 11px; }
.phase-step { display: flex; align-items: center; gap: 4px; color: #64748b; font-weight: 600; }
.phase-step.current { color: #0284c7; font-weight: 800; }
.phase-dot { width: 16px; height: 16px; border-radius: 50%; background: #cbd5e1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; }
.phase-step.current .phase-dot { background: #007AFF; }
.phase-arrow { color: #94a3b8; font-size: 10px; }

.card-route-preview { font-size: 12px; color: #475569; margin: 6px 0; }
.route-item.bold { font-weight: 700; color: #0f172a; }
.route-arrow { font-size: 11px; color: #94a3b8; margin-left: 14px; }

.card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 6px; }
.eta-text { font-size: 12px; color: #059669; }
.done-text { font-size: 12px; color: #ef4444; font-weight: 700; }
.mini-nav-btn { border: none; background: #007AFF; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }

/* 身分切換 Modal */
.picker-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; }
.picker-sheet { width: 100%; max-width: 480px; background: #ffffff; border-top-left-radius: 24px; border-top-right-radius: 24px; padding: 20px; box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3); }
.picker-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.picker-title { font-size: 16px; font-weight: 900; color: #0f172a; }
.picker-close { border: none; background: #f1f5f9; color: #64748b; width: 28px; height: 28px; border-radius: 50%; font-weight: 800; cursor: pointer; }
.picker-list { display: flex; flex-direction: column; gap: 10px; }
.picker-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; cursor: pointer; }
.picker-item.active { background: #f0fdf4; border-color: #10b981; }
.item-left { display: flex; align-items: center; gap: 12px; }
.item-avatar { font-size: 24px; }
.item-details { display: flex; flex-direction: column; }
.item-name { font-size: 14px; font-weight: 800; color: #0f172a; }
.item-vehicle { font-size: 11px; color: #64748b; }
.item-right { display: flex; align-items: center; gap: 8px; }
.order-count-chip { font-size: 11px; background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 10px; font-weight: 700; }
.order-count-chip.hasOrders { background: #dcfce7; color: #15803d; }
.check-icon { color: #10b981; font-weight: 900; font-size: 16px; }

:deep(.rider-nav-arrow) { background: #0f172a; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45); border: 2px solid #ffffff; transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1); }
:deep(.pin-bubble) { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; }
:deep(.pin-bubble.dest-bubble) { width: 28px; height: 28px; }
:deep(.pin-bubble.delivered-bubble) { background: #FF2D55 !important; font-size: 16px; width: 32px; height: 32px; border: 2.5px solid #ffffff; }
</style>