<!-- File: client/src/components/dispatch/OrderMap.vue -->
<template>
  <section class="map-panel">
    <div ref="mapContainer" class="main-map"></div>

    <div class="map-floating-hud">
      <div class="hud-item">
        <span class="hud-dot ready-dot"></span> 點選地圖可直接設定「客戶送達點」
      </div>
      <div class="hud-item" v-if="targetCustomerCoord">
        📍 目的地已鎖定：{{ customerAddress || '點選之座標點' }}
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

defineProps({
  targetCustomerCoord: {
    type: Array,
    default: null
  },
  customerAddress: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['map-click']);

const mapContainer = ref(null);
let map = null;
let previewStoreMarker = null;
let previewCustomerMarker = null;
const orderLayers = new Map();

// 🎨 向量 SVG 圖標定義
const SVG_ICONS = {
  // 🏪 店家：鮮明亮紫/琥珀金餐盤刀叉（一眼看出是餐廳，絕不與房屋搞混）
  store: `
    <div class="svg-pin-badge pin-store">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path>
        <path d="M15 2v18"></path>
        <path d="M7 2v20"></path>
        <path d="M4 2v5a3 3 0 0 0 6 0V2"></path>
      </svg>
    </div>
  `,
  customer: `
    <div class="svg-pin-badge pin-customer">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/>
      </svg>
    </div>
  `,
  delivered: `
    <div class="svg-pin-badge pin-delivered">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  `,
  // 📍 接單起點：簡潔白底藍心
  origin: `
    <div class="svg-pin-badge pin-origin">
      <div class="inner-dot"></div>
    </div>
  `,
  // 🛵 外送員：亮藍底 + 純白清楚機車圖標
  rider: `
    <div class="svg-pin-badge pin-rider">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M15.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM5 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8.8-4.5h3.6l1.8-3.6.9.9v2.7h2v-3.5l-2.2-2.2c-.4-.4-.9-.6-1.5-.6h-3.4c-.6 0-1.1.3-1.4.8L8.4 12.3c-.3.5-.2 1.2.3 1.5.5.3 1.2.2 1.5-.3zm-1.7-4.2l1.3-2.3H6v2h2.5z"/>
      </svg>
    </div>
  `
};

onMounted(() => {
  map = L.map(mapContainer.value, { 
    zoomControl: true,
    minZoom: 7,
    maxZoom: 19 
  }).setView([25.0478, 121.5170], 13);

  // 臺灣通用電子地圖 (EMAP)
  L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心</a>'
  }).addTo(map);

  map.on('click', (e) => {
    emit('map-click', e.latlng);
  });
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
  orderLayers.clear();
});

function clearPreviewStore() {
  if (previewStoreMarker && map) {
    map.removeLayer(previewStoreMarker);
    previewStoreMarker = null;
  }
}

// 🌟 清除客戶送達點預覽標記
function clearPreviewCustomer() {
  if (previewCustomerMarker && map) {
    map.removeLayer(previewCustomerMarker);
    previewCustomerMarker = null;
  }
}

function showPreviewStore(coord, name, address) {
  if (!map || !coord) return;
  const tooltipText = `<strong>店家</strong>：${name} (${address || ''})`;
  if (previewStoreMarker) {
    previewStoreMarker.setLatLng(coord);
    previewStoreMarker.setTooltipContent(tooltipText);
  } else {
    const icon = L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.store,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    previewStoreMarker = L.marker(coord, { icon, zIndexOffset: 450 }).addTo(map);
    previewStoreMarker.bindTooltip(tooltipText, {
      direction: 'top',
      offset: [0, -14],
      className: 'custom-map-tooltip'
    });
  }
  map.panTo(coord);
}

function showPreviewCustomer(coord, address) {
  if (!map || !coord) return;
  const tooltipText = `<strong>送達目的地</strong>：${address || '指定外送點'}`;
  if (previewCustomerMarker) {
    previewCustomerMarker.setLatLng(coord);
    previewCustomerMarker.setTooltipContent(tooltipText);
  } else {
    const icon = L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.customer,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    previewCustomerMarker = L.marker(coord, { icon, zIndexOffset: 500 }).addTo(map);
    previewCustomerMarker.bindTooltip(tooltipText, {
      direction: 'top',
      offset: [0, -14],
      className: 'custom-map-tooltip'
    });
  }
  map.panTo(coord);
}

function addOrderLayer(ord) {
  if (!map) return;

  const storeMarker = L.marker(ord.restaurant, {
    icon: L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.store,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    })
  }).addTo(map);
  storeMarker.bindTooltip(`<strong>店家</strong>：${ord.storeName}`, {
    direction: 'top',
    offset: [0, -14],
    className: 'custom-map-tooltip'
  });

  const clientMarker = L.marker(ord.customer, {
    icon: L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.customer,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map);
  clientMarker.bindTooltip(`<strong>客戶</strong>：${ord.address}`, {
    direction: 'top',
    offset: [0, -14],
    className: 'custom-map-tooltip'
  });

  // 第一階段完整規劃虛線（出發點 ➔ 店家 ➔ 客戶）
  const fullCoords = [...ord.pickupRouteCoords, ...ord.deliverRouteCoords];
  const plannedLine = L.polyline(fullCoords, {
    color: '#64748b',
    weight: 4,
    dashArray: '6, 8',
    opacity: 0.8
  }).addTo(map);

  const traveledLine = L.polyline([], {
    color: ord.color,
    weight: 5,
    opacity: 0.95
  }).addTo(map);

  const originMarker = L.marker(ord.riderOrigin, {
    icon: L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.origin,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    }),
    zIndexOffset: 650
  });
  originMarker.bindTooltip(`<strong>接單點</strong>：${ord.rider.name}`, {
    direction: 'top',
    offset: [0, -10],
    className: 'custom-map-tooltip'
  });

  const riderMarker = L.marker(ord.riderOrigin, {
    icon: L.divIcon({
      className: 'clean-svg-container',
      html: SVG_ICONS.rider,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    }),
    zIndexOffset: 700
  });
  riderMarker.bindTooltip(
    `<strong>外送員</strong>：${ord.rider.name} (${ord.rider.vehicle || '機車'})`,
    { direction: 'top', offset: [0, -15], className: 'custom-map-tooltip' }
  );

  orderLayers.set(ord.orderId, {
    storeMarker,
    clientMarker,
    plannedLine,
    traveledLine,
    originMarker,
    riderMarker,
    deliverRouteCoords: ord.deliverRouteCoords,
    isRiderStarted: false
  });

  try {
    const validBounds = [ord.riderOrigin, ord.restaurant, ord.customer];
    map.fitBounds(L.latLngBounds(validBounds), { padding: [60, 60] });
  } catch (e) {}
}

// 騎士移動更新回呼
function updateRiderStep(orderId, currentCoord, traveledCoords, isDelivered = false, isPickedUp = false) {
  const layer = orderLayers.get(orderId);
  if (!layer || !map) return;

  if (!layer.isRiderStarted) {
    layer.originMarker.addTo(map);
    layer.riderMarker.addTo(map);
    layer.isRiderStarted = true;
  }

  // 🌟 1. 取餐完成：清除原點與取餐舊路線，只保留「店家 ➔ 客戶」路網
  if (isPickedUp) {
    if (map.hasLayer(layer.originMarker)) {
      map.removeLayer(layer.originMarker);
    }
    layer.plannedLine.setLatLngs(layer.deliverRouteCoords);
    layer.traveledLine.setLatLngs(traveledCoords);
    layer.riderMarker.setLatLng(currentCoord);
    return;
  }

  // 🌟 2. 送達完成：移除外送員，客戶轉為綠色打勾
  if (isDelivered) {
    if (map.hasLayer(layer.riderMarker)) {
      map.removeLayer(layer.riderMarker);
    }
    layer.clientMarker.setIcon(
      L.divIcon({
        className: 'clean-svg-container',
        html: SVG_ICONS.delivered,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    );
    layer.clientMarker.setTooltipContent(`<strong>已送達</strong>：訂單完成`);
    return;
  }

  // 一般前進
  layer.riderMarker.setLatLng(currentCoord);
  layer.traveledLine.setLatLngs(traveledCoords);
}

// 🌟 清除已送達訂單在地圖上的所有圖層（店家標記、客戶標記、軌跡線）
function removeOrderLayers(orderIdsToRemove) {
  if (!map || !Array.isArray(orderIdsToRemove)) return;

  orderIdsToRemove.forEach((id) => {
    const layer = orderLayers.get(id);
    if (layer) {
      if (layer.storeMarker && map.hasLayer(layer.storeMarker)) map.removeLayer(layer.storeMarker);
      if (layer.clientMarker && map.hasLayer(layer.clientMarker)) map.removeLayer(layer.clientMarker);
      if (layer.plannedLine && map.hasLayer(layer.plannedLine)) map.removeLayer(layer.plannedLine);
      if (layer.traveledLine && map.hasLayer(layer.traveledLine)) map.removeLayer(layer.traveledLine);
      if (layer.originMarker && map.hasLayer(layer.originMarker)) map.removeLayer(layer.originMarker);
      if (layer.riderMarker && map.hasLayer(layer.riderMarker)) map.removeLayer(layer.riderMarker);
      orderLayers.delete(id);
    }
  });
}

defineExpose({
  clearPreviewStore,
  clearPreviewCustomer,
  showPreviewStore,
  showPreviewCustomer,
  addOrderLayer,
  updateRiderStep,
  removeOrderLayers // 🌟 補上這行
});
</script>

<style scoped>
.map-panel {
  flex: 1;
  height: 100%;
  position: relative;
}
.main-map {
  width: 100%;
  height: 100%;
}

.map-floating-hud {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hud-dot.ready-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  display: inline-block;
  margin-right: 4px;
}

/* =========================================================
   🌟 現代化向量 SVG 地圖標記
   ========================================================= */
:deep(.clean-svg-container) {
  background: transparent !important;
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.svg-pin-badge) {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
:deep(.svg-pin-badge:hover) {
  transform: scale(1.25);
}

/* 🏪 店家：亮紫羅蘭方圓形 + 純白立體邊框 + 刀叉美食標誌 */
:deep(.pin-store) {
  width: 26px;
  height: 26px;
  background: #7c3aed;
  color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 7px rgba(124, 58, 237, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* 客戶：緋紅簡約定位圓徽 */
:deep(.pin-customer) {
  width: 24px;
  height: 24px;
  background: #ef4444;
  color: #ffffff;
  border: 1.5px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

/* 送達：清爽翠綠打勾 */
:deep(.pin-delivered) {
  width: 24px;
  height: 24px;
  background: #10b981;
  color: #ffffff;
  border: 1.5px solid #ffffff;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* 起點：精緻純白底座 + 亮藍微心 */
:deep(.pin-origin) {
  width: 18px;
  height: 18px;
  background: #ffffff;
  border: 1.5px solid #0284c7;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  display: grid;
  place-items: center;
}
:deep(.pin-origin .inner-dot) {
  width: 6px;
  height: 6px;
  background: #0284c7;
  border-radius: 50%;
}

/* 🛵 外送騎士：鮮明亮藍底 + 純白立體邊框 + 純白機車 */
:deep(.pin-rider) {
  width: 28px;
  height: 28px;
  background: #0284c7;
  color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.6), 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Tooltip 浮動提示文字 */
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