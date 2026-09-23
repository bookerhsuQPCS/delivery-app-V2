<template>
  <div class="driver-page">
    <div ref="mapContainer" class="map-view"></div>

    <!-- 頂部 HUD 駕駛導航看板 -->
    <div class="driver-hud" v-if="focusedOrder">
      <div class="hud-nav-icon">
        <span class="nav-arrow">⬆</span>
      </div>
      <div class="hud-info">
        <div class="hud-target">
          【{{ focusedOrder.rider?.name }}】{{ focusedOrder.status === '配送中' ? '正在配送中' : '訂單已送達' }}
        </div>
        <div class="hud-address">{{ focusedOrder.address }}</div>
      </div>
      <div class="hud-eta">
        <div class="eta-num">{{ focusedOrder.eta }}</div>
        <div class="eta-unit">分鐘</div>
      </div>
    </div>

    <!-- 頂部待機提示 -->
    <div class="driver-idle-hud" v-else>
      <div class="idle-badge">🟢 外送員待命中</div>
      <div class="idle-subtitle">
        {{ selectedRiderName ? `【${selectedRiderName}】目前無任務` : '等待調度中心派單...' }}
      </div>
    </div>

    <!-- 左側外送員名單 (Sidebar) -->
    <aside class="left-rider-sidebar">
      <div class="sidebar-header">
        <span class="header-icon">🛵</span>
        <span class="header-title">外送員名單</span>
      </div>

      <div class="rider-menu-list">
        <button 
          class="rider-menu-item" 
          :class="{ active: selectedRiderName === null }"
          @click="selectRider(null)"
        >
          <div class="item-avatar all-avatar">🌐</div>
          <div class="item-meta">
            <span class="item-name">全部外送員</span>
            <span class="item-badge">{{ orders.length }} 單</span>
          </div>
        </button>

        <button 
          v-for="rider in activeRiders" 
          :key="rider.name" 
          class="rider-menu-item"
          :class="{ active: selectedRiderName === rider.name }"
          @click="selectRider(rider.name)"
        >
          <div class="item-avatar">{{ rider.avatar }}</div>
          <div class="item-meta">
            <div class="name-row">
              <span class="item-name">{{ rider.name }}</span>
              <span class="item-rating">★ {{ rider.rating }}</span>
            </div>
            <div class="sub-row">
              <span class="item-plate">{{ rider.vehicle }}</span>
              <span class="item-badge active-tag">{{ rider.count }} 單</span>
            </div>
          </div>
        </button>
      </div>
    </aside>

    <!-- 底部外送員任務清單 -->
    <div class="driver-bottom-sheet">
      <div class="sheet-drag-handle"></div>

      <div v-if="filteredOrders.length === 0" class="sheet-empty">
        <div class="empty-icon">🛵</div>
        <div class="empty-title">
          {{ selectedRiderName ? `【${selectedRiderName}】無進行中訂單` : '目前無派單任務' }}
        </div>
        <div class="empty-subtitle">請於調度後台點擊「派新單」，資料將自動同步至本端</div>
      </div>

      <div v-else class="driver-card-list">
        <div 
          v-for="order in filteredOrders" 
          :key="order.orderId" 
          class="driver-card" 
          :class="{ active: selectedOrderId === order.orderId, finished: order.status === '已送達' }"
          @click="focusOrder(order.orderId)"
        >
          <div class="rider-header">
            <div class="rider-profile">
              <div class="rider-avatar-bubble" :style="{ borderColor: order.color }">
                {{ order.rider?.avatar || '🛵' }}
              </div>
              <div class="rider-detail">
                <div class="rider-name-row">
                  <span class="rider-name">{{ order.rider?.name }}</span>
                  <span class="rider-rating">★ {{ order.rider?.rating || '5.0' }}</span>
                </div>
                <div class="rider-vehicle">{{ order.rider?.vehicle }} · {{ order.orderId }}</div>
              </div>
            </div>
            <div class="order-badge" :class="{ completed: order.status === '已送達' }">
              {{ order.status }}
            </div>
          </div>

          <div class="trip-timeline">
            <div class="trip-node pickup">
              <span class="node-icon">🏪</span>
              <span class="node-name">{{ order.storeName }}</span>
            </div>
            <div class="trip-line"></div>
            <div class="trip-node dropoff">
              <span class="node-icon">🏠</span>
              <span class="node-name">{{ order.address }}</span>
            </div>
          </div>

          <div class="card-footer">
            <span class="dist-tag">全程 {{ order.totalDistanceKm }} km</span>
            <span v-if="order.status === '配送中'" class="eta-tag">
              預計 <b>{{ order.eta }}</b> 分鐘抵達
            </span>
            <span v-else class="success-tag">
              🎉 已送達指定地址
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';

const mapContainer = ref(null);
const selectedOrderId = ref(null);
const selectedRiderName = ref(null);
const orders = reactive([]);

let map = null;
let ws = null;
const orderLayers = new Map();

const activeRiders = computed(() => {
  const mapRiders = new Map();
  orders.forEach(o => {
    if (o.rider && o.rider.name) {
      if (!mapRiders.has(o.rider.name)) {
        mapRiders.set(o.rider.name, {
          name: o.rider.name,
          avatar: o.rider.avatar,
          rating: o.rider.rating || '5.0',
          vehicle: o.rider.vehicle || 'GOG-0000',
          count: 0
        });
      }
      mapRiders.get(o.rider.name).count++;
    }
  });
  return Array.from(mapRiders.values());
});

const filteredOrders = computed(() => {
  if (!selectedRiderName.value) return orders;
  return orders.filter(o => o.rider?.name === selectedRiderName.value);
});

const focusedOrder = computed(() => {
  return filteredOrders.value.find(o => o.orderId === selectedOrderId.value) || filteredOrders.value[0] || null;
});

onMounted(() => {
  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false
  }).setView([25.0375, 121.5637], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  connectWebSocket();
});

function createRiderIcon(orderId, color) {
  return L.divIcon({
    className: 'custom-rider-wrapper',
    html: `
      <div id="rider-driver-nav-${orderId}" class="nav-arrow-bubble">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <polygon points="12 2, 19 21, 12 17, 5 21" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function setupOrderLayers(ord) {
  if (orderLayers.has(ord.orderId)) return;

  const marker = L.marker(ord.restaurant, {
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
  const tPoly = L.polyline([], { color: '#8E8E93', weight: 5, opacity: 0.8 });
  const rPoly = L.polyline(ord.routeCoords, { color: ord.color, weight: 6, opacity: 0.95 });

  const layerObj = {
    riderMarker: marker,
    traveledPolyline: tPoly,
    remainingPolyline: rPoly,
    storeMarker: sMarker,
    userMarker: uMarker,
    coords: ord.routeCoords,
    riderName: ord.rider?.name
  };

  orderLayers.set(ord.orderId, layerObj);

  if (!selectedRiderName.value || layerObj.riderName === selectedRiderName.value) {
    addLayerToMap(layerObj);
  }
}

function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.port === '5173' ? `${window.location.hostname}:8080` : window.location.host;
  ws = new WebSocket(`${wsProtocol}//${host}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // 1. 初始化接收目前伺服器所有訂單
    if (data.type === 'INIT_ORDERS') {
      orders.splice(0, orders.length, ...data.orders);
      orders.forEach(ord => setupOrderLayers(ord));
      syncMapLayersVisibility();
      if (orders.length > 0 && !selectedOrderId.value) {
        selectedOrderId.value = orders[0].orderId;
      }
    }

    // 2. 接收即時新派單
    if (data.type === 'ORDER_DISPATCHED') {
      const ord = data.order;
      orders.unshift(ord);
      selectedOrderId.value = ord.orderId;
      setupOrderLayers(ord);
      syncMapLayersVisibility();

      const layer = orderLayers.get(ord.orderId);
      if (layer && layer.remainingPolyline) {
        map.fitBounds(layer.remainingPolyline.getBounds(), {
          paddingBottomRight: [30, 260],
          paddingTopLeft: [220, 100]
        });
      }
    }

    // 3. 接收位置更新
    if (data.type === 'ORDER_LOCATION_UPDATE') {
      const item = orders.find(o => o.orderId === data.orderId);
      if (item) {
        item.status = data.status;
        item.eta = data.eta;
      }

      const layer = orderLayers.get(data.orderId);
      if (layer) {
        const navEl = document.getElementById(`rider-driver-nav-${data.orderId}`);
        if (navEl) navEl.style.transform = `rotate(${data.bearing}deg)`;
        layer.riderMarker.setLatLng([data.lat, data.lng]);

        if (data.status === '已送達' && layer.userMarker) {
          const deliveredIcon = L.divIcon({
            className: 'pin',
            html: `<div class="pin-bubble delivered-bubble">🎉</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          layer.userMarker.setIcon(deliveredIcon);
        }

        if (data.step !== undefined) {
          layer.traveledPolyline.setLatLngs(layer.coords.slice(0, data.step + 1));
          layer.remainingPolyline.setLatLngs(layer.coords.slice(data.step));
        }
      }
    }

    // 4. 清除訂單
    if (data.type === 'ORDERS_CLEARED') {
      data.orderIds.forEach((id) => {
        const layer = orderLayers.get(id);
        if (layer) {
          removeLayerFromMap(layer);
          orderLayers.delete(id);
        }
      });

      for (let i = orders.length - 1; i >= 0; i--) {
        if (data.orderIds.includes(orders[i].orderId)) {
          orders.splice(i, 1);
        }
      }
      if (data.orderIds.includes(selectedOrderId.value)) {
        selectedOrderId.value = filteredOrders.value.length > 0 ? filteredOrders.value[0].orderId : null;
      }
    }
  };
}

function removeLayerFromMap(layer) {
  if (layer.riderMarker && map.hasLayer(layer.riderMarker)) map.removeLayer(layer.riderMarker);
  if (layer.remainingPolyline && map.hasLayer(layer.remainingPolyline)) map.removeLayer(layer.remainingPolyline);
  if (layer.traveledPolyline && map.hasLayer(layer.traveledPolyline)) map.removeLayer(layer.traveledPolyline);
  if (layer.storeMarker && map.hasLayer(layer.storeMarker)) map.removeLayer(layer.storeMarker);
  if (layer.userMarker && map.hasLayer(layer.userMarker)) map.removeLayer(layer.userMarker);
}

function addLayerToMap(layer) {
  if (layer.riderMarker && !map.hasLayer(layer.riderMarker)) map.addLayer(layer.riderMarker);
  if (layer.remainingPolyline && !map.hasLayer(layer.remainingPolyline)) map.addLayer(layer.remainingPolyline);
  if (layer.traveledPolyline && !map.hasLayer(layer.traveledPolyline)) map.addLayer(layer.traveledPolyline);
  if (layer.storeMarker && !map.hasLayer(layer.storeMarker)) map.addLayer(layer.storeMarker);
  if (layer.userMarker && !map.hasLayer(layer.userMarker)) map.addLayer(layer.userMarker);
}

function syncMapLayersVisibility() {
  orderLayers.forEach((layer) => {
    if (!selectedRiderName.value || layer.riderName === selectedRiderName.value) {
      addLayerToMap(layer);
    } else {
      removeLayerFromMap(layer);
    }
  });
}

function selectRider(name) {
  selectedRiderName.value = name;
  syncMapLayersVisibility();

  if (filteredOrders.value.length > 0) {
    selectedOrderId.value = filteredOrders.value[0].orderId;
    focusOrder(selectedOrderId.value);
  } else {
    selectedOrderId.value = null;
  }
}

function focusOrder(orderId) {
  selectedOrderId.value = orderId;
  const layer = orderLayers.get(orderId);
  if (layer && layer.riderMarker) {
    map.panTo(layer.riderMarker.getLatLng(), { animate: true, duration: 0.6 });
  }
}

onUnmounted(() => {
  if (ws) ws.close();
  if (map) map.remove();
});
</script>

<style scoped>
.driver-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #121212;
}

.map-view {
  width: 100%;
  height: 100%;
}

.driver-hud {
  position: absolute;
  top: 14px;
  left: 220px;
  right: 14px;
  z-index: 1000;
  background: #1e293b;
  color: #fff;
  border-radius: 18px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.hud-nav-icon {
  width: 42px;
  height: 42px;
  background: #007AFF;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 900;
}

.hud-info {
  flex: 1;
  overflow: hidden;
}

.hud-target {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.hud-address {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-eta {
  text-align: right;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  padding-left: 12px;
}

.eta-num {
  font-size: 22px;
  font-weight: 900;
  color: #06C167;
  line-height: 1;
}

.eta-unit {
  font-size: 10px;
  color: #94a3b8;
}

.driver-idle-hud {
  position: absolute;
  top: 14px;
  left: 220px;
  right: 14px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.idle-badge {
  font-size: 13px;
  font-weight: 800;
  color: #06C167;
  margin-bottom: 2px;
}

.idle-subtitle {
  font-size: 12px;
  color: #64748b;
}

.left-rider-sidebar {
  position: absolute;
  top: 14px;
  left: 14px;
  bottom: 280px;
  width: 190px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 8px;
}

.header-icon {
  font-size: 16px;
}

.header-title {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

.rider-menu-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rider-menu-item {
  border: none;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.rider-menu-item:hover {
  background: #edf2f7;
}

.rider-menu-item.active {
  background: #007AFF;
  border-color: #007AFF;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.35);
}

.rider-menu-item.active * {
  color: #ffffff !important;
}

.item-avatar {
  font-size: 18px;
  width: 30px;
  height: 30px;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.all-avatar {
  background: #e0f2fe;
}

.item-meta {
  flex: 1;
  overflow: hidden;
}

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.item-name {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
}

.item-rating {
  font-size: 10px;
  font-weight: 700;
  color: #eab308;
}

.sub-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-plate {
  font-size: 9px;
  color: #64748b;
}

.item-badge {
  font-size: 10px;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 5px;
  border-radius: 10px;
  font-weight: 700;
}

.active-tag {
  background: #dcfce7;
  color: #15803d;
}

.driver-bottom-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #ffffff;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 12px 16px 20px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
  max-height: 260px;
  overflow-y: auto;
}

.sheet-drag-handle {
  width: 40px;
  height: 5px;
  background: #cbd5e1;
  border-radius: 3px;
  margin: 0 auto 10px;
}

.sheet-empty {
  text-align: center;
  padding: 20px 0;
}

.empty-icon {
  font-size: 36px;
  margin-bottom: 6px;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.empty-subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.driver-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.driver-card {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.driver-card.active {
  background: #f0fdf4;
  border-color: #06C167;
  box-shadow: 0 4px 12px rgba(6, 193, 103, 0.15);
}

.driver-card.finished {
  background: #fafafa;
  opacity: 0.85;
}

.rider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.rider-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rider-avatar-bubble {
  width: 38px;
  height: 38px;
  background: #ffffff;
  border: 2px solid #007AFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.rider-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rider-name {
  font-size: 14px;
  font-weight: 800;
  color: #1e293b;
}

.rider-rating {
  font-size: 11px;
  font-weight: 700;
  color: #eab308;
  background: #fefce8;
  padding: 1px 5px;
  border-radius: 4px;
}

.rider-vehicle {
  font-size: 11px;
  color: #64748b;
}

.order-badge {
  font-size: 11px;
  font-weight: 700;
  background: #dcfce7;
  color: #15803d;
  padding: 4px 8px;
  border-radius: 6px;
}

.order-badge.completed {
  background: #ffe4e6;
  color: #e11d48;
}

.trip-timeline {
  margin: 8px 0;
  position: relative;
}

.trip-node {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.trip-node.dropoff {
  color: #0f172a;
  font-weight: 700;
}

.trip-line {
  width: 2px;
  height: 10px;
  background: #cbd5e1;
  margin-left: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed #e2e8f0;
  padding-top: 8px;
  margin-top: 6px;
  font-size: 12px;
}

.dist-tag {
  color: #64748b;
  font-weight: 600;
}

.eta-tag {
  color: #059669;
}

.success-tag {
  color: #e11d48;
  font-weight: 800;
}

:deep(.pin-bubble) {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  border: 2px solid white;
}

:deep(.pin-bubble.dest-bubble) {
  width: 28px;
  height: 28px;
}

:deep(.pin-bubble.delivered-bubble) {
  background: #FF2D55 !important;
  font-size: 16px;
  width: 32px;
  height: 32px;
  border: 2.5px solid #ffffff;
  box-shadow: 0 4px 12px rgba(255, 45, 85, 0.45);
  animation: pulse-delivered 1.5s infinite;
}

@keyframes pulse-delivered {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

:deep(.nav-arrow-bubble) {
  background: #0f172a;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  border: 2px solid #ffffff;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
</style>