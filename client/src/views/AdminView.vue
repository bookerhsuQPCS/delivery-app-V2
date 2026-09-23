<!-- File: client/src/views/AdminView.vue -->
<template>
  <div class="admin-page">
    <div ref="mapContainer" class="map-view"></div>

    <!-- 頂部導航列 -->
    <div class="nav-bar">
      <span class="brand">🏢 去平台化調度指揮中心 (V2)</span>
      <a href="/driver" target="_blank" class="link-driver">📲 駕駛端 (HUD) ↗</a>
      <a href="/mobile" target="_blank" class="link-mobile">📱 手機端 (Turn-by-Turn) ↗</a>
    </div>

    <!-- 頂部操作按鈕 -->
    <div class="admin-control-panel">
      <button 
        class="btn btn-refresh-candidates" 
        @click="regenerateCandidates"
        :disabled="!currentStore"
      >
        🎯 搜尋外送員 ({{ candidateRiders.length }})
      </button>

      <button 
        class="btn btn-dispatch" 
        @click="dispatchMealReadyOrder" 
        :disabled="isDispatching || candidateRiders.length === 0 || !customerCoords || !currentStore"
      >
        {{ isDispatching ? '⏳ 調度路徑計算中...' : (currentStore ? '🍳 備餐與指派' : '👈 請先選擇取餐店家') }}
      </button>

      <button 
        class="btn btn-clear" 
        @click="clearCompleted" 
        :disabled="completedCount === 0"
      >
        🧹 清除已送達 ({{ completedCount }})
      </button>
    </div>

    <!-- 頂部路徑與店家選擇卡片 (雙向綁定 category 與 store-change) -->
    <RoutePlanningCard
      :customerCoords="customerCoords"
      :currentAddress="currentAddress"
      :currentStore="currentStore"
      :availableStores="availableStores"
      :filteredGroupedStores="filteredGroupedStores"
      :isFarStore="isFarStore"
      :currentStoreDistanceKm="currentStoreDistanceKm"
      :isSearchingAddress="isSearchingAddress"
      :currentCategory="selectedCategory"
      @address-search="handleAddressSearch"
      @store-change="onStoreSelectChange"
      @update:category="onCategoryChange"
    />

    <!-- 右側面板：外送員名單與備餐狀態 -->
    <StandbyPanel
      :currentStore="currentStore"
      :candidateRiders="candidateRiders"
      :assignedCandidateName="assignedCandidateName"
      :activeDispatchOrder="activeDispatchOrder"
    />

    <!-- 左側側欄：車隊動態 -->
    <FleetSidebar
      :activeRiders="activeRiders"
      :selectedRiderName="selectedRiderName"
      :totalOrdersCount="orders.length"
      @select-rider="selectRider"
    />

    <!-- 底部訂單管理列表 -->
    <OrderBottomSheet
      :filteredOrders="filteredOrders"
      :selectedOrderId="selectedOrderId"
      :selectedRiderName="selectedRiderName"
      @focus-order="focusOrder"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';
import { 
  getDistanceKm, 
  getRandomLocationInRange, 
  calculateBearing, 
  isDrinkStore, 
  getApiBase 
} from '@/utils/geoUtils';

import RoutePlanningCard from '@/components/admin/RoutePlanningCard.vue';
import StandbyPanel from '@/components/admin/StandbyPanel.vue';
import FleetSidebar from '@/components/admin/FleetSidebar.vue';
import OrderBottomSheet from '@/components/admin/OrderBottomSheet.vue';

const mapContainer = ref(null);
const selectedOrderId = ref(null);
const selectedRiderName = ref(null);
const orders = reactive([]);

const isSearchingAddress = ref(false);
const customerCoords = ref(null);
const currentAddress = ref('尚未設定');
const isDispatching = ref(false);
const assignedCandidateName = ref(null);

const STANDARD_RADIUS_KM = 5.0;
const MAX_RADIUS_KM = 10.0;
const selectedCategory = ref('ALL');

const ALL_STORES = ref([]);
const currentStore = ref(null);

// 切換分類 (全部 / 飲料 / 一般)
function onCategoryChange(cat) {
  selectedCategory.value = cat;
}

// 10km 內所有店家 (計算距離並預先標記 isDrink)
const availableStores = computed(() => {
  if (!customerCoords.value || ALL_STORES.value.length === 0) return [];
  return ALL_STORES.value
    .map(store => {
      const distKm = getDistanceKm(store.coords, customerCoords.value);
      const isDrink = isDrinkStore(store);
      return { ...store, distKm, isDrink };
    })
    .filter(store => store.distKm <= MAX_RADIUS_KM)
    .sort((a, b) => a.distKm - b.distKm);
});

// 根據選定分類過濾，並拆為標準 (<=5km) 與稍遠 (5~10km)
const filteredGroupedStores = computed(() => {
  const filtered = availableStores.value.filter(s => {
    if (selectedCategory.value === 'DRINK') {
      return s.isDrink === true;
    }
    if (selectedCategory.value === 'FOOD') {
      return s.isDrink === false;
    }
    return true; // 'ALL' 全部
  });

  return {
    standard: filtered.filter(s => s.distKm <= STANDARD_RADIUS_KM),
    far: filtered.filter(s => s.distKm > STANDARD_RADIUS_KM && s.distKm <= MAX_RADIUS_KM)
  };
});

const currentStoreDistanceKm = computed(() => {
  if (!customerCoords.value || !currentStore.value) return 0;
  return getDistanceKm(currentStore.value.coords, customerCoords.value);
});

const isFarStore = computed(() => currentStoreDistanceKm.value > STANDARD_RADIUS_KM);

const calculatedDeliveryFee = computed(() => {
  const base = 49;
  const surcharge = isFarStore.value ? 30 : 0;
  return { base, surcharge, total: base + surcharge };
});

async function loadRestaurantsFromBackend() {
  try {
    const res = await fetch(`${getApiBase()}/api/restaurants`);
    if (res.ok) {
      ALL_STORES.value = await res.json();
    }
  } catch (err) {
    console.error('無法讀取商家清單:', err);
  }
}

async function handleAddressSearch(addr) {
  if (!addr || !addr.trim()) return;
  isSearchingAddress.value = true;
  try {
    const res = await fetch(`${getApiBase()}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr.trim() })
    });
    const data = await res.json();
    if (data.success && data.coords) {
      const newCoords = data.coords;
      customerCoords.value = newCoords;
      currentAddress.value = addr.trim();

      if (currentStore.value && getDistanceKm(currentStore.value.coords, newCoords) > MAX_RADIUS_KM) {
        currentStore.value = null;
        if (currentStoreMarker) { 
          map.removeLayer(currentStoreMarker); 
          currentStoreMarker = null; 
        }
        candidateRiders.value = [];
      }
      updateCustomerMarker(newCoords);
      updateDeliveryCircles(newCoords);
      if (map) map.flyTo(newCoords, 14, { duration: 0.8 });
    } else {
      alert(data.message || '找不到該地址的座標');
    }
  } catch (e) {
    alert('地址查詢服務連線異常，請確認後端是否運行於 3000 port');
  } finally {
    isSearchingAddress.value = false;
  }
}

// 下拉選單選取商家：採彈性匹配，解決 address 欄位格式差異問題
function onStoreSelectChange(storeKey) {
  if (!storeKey) return;
  
  let found = null;
  if (storeKey.includes('__')) {
    const [storeName, storeAddress] = storeKey.split('__');
    found = ALL_STORES.value.find(s => s.name === storeName && (s.address === storeAddress || !storeAddress));
    if (!found) {
      found = ALL_STORES.value.find(s => s.name === storeName);
    }
  } else {
    found = ALL_STORES.value.find(s => s.name === storeKey);
  }

  if (found) {
    currentStore.value = found;
    updateStoreMarker(found.coords);
    generateCandidatesNearStore(found.coords);
  }
}

const REGISTERED_RIDERS_POOL = [
  { name: '陳小豪', avatar: '🛵', vehicle: 'ABC-1234', rating: '4.9' },
  { name: '林志明', avatar: '⚡', vehicle: 'EL-8899', rating: '5.0' },
  { name: '張雅晴', avatar: '🛵', vehicle: 'XYZ-5678', rating: '4.8' },
  { name: '黃俊傑', avatar: '🚴', vehicle: 'MB-9921', rating: '4.9' },
  { name: '吳美玲', avatar: '🛵', vehicle: 'GOG-7788', rating: '5.0' },
  { name: '蔡宏偉', avatar: '🏍️', vehicle: 'TK-3344', rating: '4.9' }
];

const candidateRiders = ref([]);
let map = null, ws = null, broadcastChannel = null;
let currentCustomerMarker = null, currentStoreMarker = null;
let standardRadiusCircle = null, farRadiusCircle = null;
const orderLayers = new Map();
const localTimers = new Map();

const activeDispatchOrder = computed(() => orders.find(o => o.status !== '已送達') || orders[0] || null);

const activeRiders = computed(() => {
  const mapRiders = new Map();
  orders.forEach(o => {
    if (o.rider?.name) {
      if (!mapRiders.has(o.rider.name)) {
        mapRiders.set(o.rider.name, { ...o.rider, count: 0 });
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

const completedCount = computed(() => orders.filter(o => o.status === '已送達').length);

async function fetchAddress(lat, lng) {
  let resolved = `雙北外送點 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  currentAddress.value = resolved;
  try {
    const res = await fetch(`${getApiBase()}/api/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.address) resolved = data.address;
    }
  } catch (err) {}
  currentAddress.value = resolved;
}

function generateCandidatesNearStore(storeCoord) {
  assignedCandidateName.value = null;
  const count = Math.random() > 0.4 ? 3 : 2;
  const shuffled = [...REGISTERED_RIDERS_POOL].sort(() => 0.5 - Math.random());
  candidateRiders.value = shuffled.slice(0, count).map((r, idx) => {
    const coords = getRandomLocationInRange(storeCoord, 0.1, 2.0);
    const dist = getDistanceKm(coords, storeCoord);
    return {
      ...r,
      id: `CAND-${idx + 1}`,
      coords,
      distToStoreKm: dist,
      travelMinutes: Math.max(1, Math.min(5, Math.round(dist * 2.2) + 1))
    };
  });
}

function regenerateCandidates() {
  if (currentStore.value) generateCandidatesNearStore(currentStore.value.coords);
}

onMounted(async () => {
  await loadRestaurantsFromBackend();
  try { broadcastChannel = new BroadcastChannel('delivery_dispatch_channel'); } catch (e) {}

  map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false }).setView([25.0475, 121.5170], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  map.on('click', async (e) => {
    const newCoords = [e.latlng.lat, e.latlng.lng];
    customerCoords.value = newCoords;
    updateCustomerMarker(newCoords);
    updateDeliveryCircles(newCoords);

    if (currentStore.value && getDistanceKm(currentStore.value.coords, newCoords) > MAX_RADIUS_KM) {
      currentStore.value = null;
      if (currentStoreMarker) { 
        map.removeLayer(currentStoreMarker); 
        currentStoreMarker = null; 
      }
      candidateRiders.value = [];
    }
    await fetchAddress(newCoords[0], newCoords[1]);
  });

  connectWebSocket();
});

function updateCustomerMarker(latlng) {
  if (currentCustomerMarker) map.removeLayer(currentCustomerMarker);
  const targetIcon = L.divIcon({
    className: 'custom-client-pin',
    html: `<div class="client-radar-wrapper"><div class="client-radar-wave"></div><div class="client-dot">🏠</div></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  currentCustomerMarker = L.marker(latlng, { icon: targetIcon, zIndexOffset: 500 }).addTo(map);
}

function updateDeliveryCircles(latlng) {
  if (standardRadiusCircle && map.hasLayer(standardRadiusCircle)) map.removeLayer(standardRadiusCircle);
  if (farRadiusCircle && map.hasLayer(farRadiusCircle)) map.removeLayer(farRadiusCircle);

  farRadiusCircle = L.circle(latlng, {
    radius: MAX_RADIUS_KM * 1000,
    color: '#f97316',
    fillColor: '#fdba74',
    fillOpacity: 0.05,
    weight: 1.5,
    dashArray: '6, 6'
  }).addTo(map);

  standardRadiusCircle = L.circle(latlng, {
    radius: STANDARD_RADIUS_KM * 1000,
    color: '#10b981',
    fillColor: '#86efac',
    fillOpacity: 0.08,
    weight: 2,
    dashArray: '4, 4'
  }).addTo(map);
}

function updateStoreMarker(latlng) {
  if (currentStoreMarker) { map.removeLayer(currentStoreMarker); currentStoreMarker = null; }
  if (!currentStore.value || !latlng) return;

  const isDrink = isDrinkStore(currentStore.value);
  const storeIcon = L.divIcon({
    className: 'custom-store-pin',
    html: `
      <div class="store-pin-bubble" style="${isDrink ? 'background:#059669;' : 'background:#0284c7;'}">
        <span>${isDrink ? '🧋' : '🍱'}</span>
        <span>${currentStore.value.name}</span>
      </div>
    `,
    iconSize: [110, 32],
    iconAnchor: [55, 16]
  });
  currentStoreMarker = L.marker(latlng, { icon: storeIcon, zIndexOffset: 600 }).addTo(map);
}

async function fetchOsrmRoute(startCoord, endCoord) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const r = data.routes[0];
      return {
        coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distKm: (r.distance / 1000).toFixed(1)
      };
    }
  } catch (e) {}

  const steps = 30;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    coords.push([
      startCoord[0] + (endCoord[0] - startCoord[0]) * (i / steps),
      startCoord[1] + (endCoord[1] - startCoord[1]) * (i / steps)
    ]);
  }
  return { coords, distKm: getDistanceKm(startCoord, endCoord).toString() };
}

async function dispatchMealReadyOrder() {
  if (isDispatching.value || !customerCoords.value || !currentStore.value) return;
  if (candidateRiders.value.length === 0) generateCandidatesNearStore(currentStore.value.coords);
  if (candidateRiders.value.length === 0) return;

  isDispatching.value = true;
  const chosenIndex = Math.floor(Math.random() * candidateRiders.value.length);
  const assignedRider = candidateRiders.value[chosenIndex];
  assignedCandidateName.value = assignedRider.name;

  const prepTotalMin = Math.floor(Math.random() * 21) + 10;
  const departAtMin = Math.floor(Math.random() * (prepTotalMin + 1));
  const orderNum = 100 + orders.length + 1;
  const orderId = `ORD-${orderNum}`;
  const store = currentStore.value;
  const customer = customerCoords.value;
  const riderOrigin = assignedRider.coords;

  const pickupRoute = await fetchOsrmRoute(riderOrigin, store.coords);
  const deliverRoute = await fetchOsrmRoute(store.coords, customer);
  const totalDist = (parseFloat(pickupRoute.distKm) + parseFloat(deliverRoute.distKm)).toFixed(1);
  const colorPalette = ['#06C167', '#007AFF', '#FF9500', '#AF52DE', '#FF2D55'];
  const color = colorPalette[orderNum % colorPalette.length];
  const feeData = calculatedDeliveryFee.value;

  const newOrder = {
    orderId,
    name: `訂單 #${orderNum} (${store.name})`,
    storeName: store.name,
    storeCategory: isDrinkStore(store) ? '飲料手搖' : '一般餐飲',
    address: currentAddress.value,
    rider: { ...assignedRider },
    color,
    restaurant: store.coords,
    customer,
    riderOrigin,
    prepTotalMin,
    prepRemainingMin: prepTotalMin,
    departAtMin,
    elapsedSimMin: 0,
    pickupRouteCoords: pickupRoute.coords,
    deliverRouteCoords: deliverRoute.coords,
    routeCoords: [...pickupRoute.coords, ...deliverRoute.coords],
    pickupDistKm: pickupRoute.distKm,
    deliverDistKm: deliverRoute.distKm,
    totalDistanceKm: totalDist,
    deliveryFee: feeData.total,
    surcharge: feeData.surcharge,
    stage: departAtMin === 0 ? 'PICKING_UP' : 'STANDBY',
    status: departAtMin === 0 ? '前往取餐中' : `等候出發 (${departAtMin}分後出發)`,
    eta: Math.ceil((pickupRoute.coords.length + deliverRoute.coords.length) * 0.25)
  };

  orders.unshift(newOrder);
  selectedOrderId.value = newOrder.orderId;

  setupTwoStageOrderLayers(newOrder);
  syncMapLayersVisibility();

  fetch(`${getApiBase()}/api/dispatch-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: newOrder.orderId,
      storeName: newOrder.storeName,
      storeCategory: newOrder.storeCategory,
      riderName: newOrder.rider.name,
      deliverDistKm: newOrder.deliverDistKm,
      deliveryFee: newOrder.deliveryFee,
      surcharge: newOrder.surcharge,
      address: newOrder.address
    })
  }).catch(() => {});

  broadcastOrderUpdate({
    type: 'DISPATCH_NEW',
    order: newOrder,
    customer,
    address: currentAddress.value
  });

  startTwoStageOrderSimulation(newOrder);

  map.fitBounds(L.latLngBounds([riderOrigin, store.coords, customer]), {
    paddingBottomRight: [350, 260],
    paddingTopLeft: [220, 110]
  });

  isDispatching.value = false;
}

function setupTwoStageOrderLayers(ord) {
  if (orderLayers.has(ord.orderId)) return;

  const riderMarker = L.marker(ord.riderOrigin, {
    icon: L.divIcon({
      className: 'custom-rider-wrapper',
      html: `<div id="rider-admin-nav-${ord.orderId}" class="nav-arrow-bubble"><svg viewBox="0 0 24 24" width="16" height="16"><polygon points="12 2, 19 21, 12 17, 5 21" fill="${ord.color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    }),
    zIndexOffset: 1000
  });

  const pickupPolyline = L.polyline(ord.pickupRouteCoords, { color: '#007AFF', weight: 5, dashArray: '6, 8', opacity: 0.9 });
  const deliverPolyline = L.polyline(ord.deliverRouteCoords, { color: ord.color, weight: 6, opacity: 0.95 });
  const traveledPolyline = L.polyline([], { color: '#94a3b8', weight: 4, opacity: 0.7 });

  const storeMarker = L.marker(ord.restaurant, {
    icon: L.divIcon({
      className: 'pin',
      html: `<div class="pin-bubble" style="background:${ord.color}">🏪</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })
  });

  const userMarker = L.marker(ord.customer, {
    icon: L.divIcon({
      className: 'pin',
      html: `<div class="pin-bubble dest-bubble" style="background:${ord.color}">🏠</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  });

  const layerObj = {
    riderMarker,
    pickupPolyline,
    deliverPolyline,
    traveledPolyline,
    storeMarker,
    userMarker,
    ord,
    riderName: ord.rider?.name
  };

  orderLayers.set(ord.orderId, layerObj);
  addLayerToMap(layerObj);
}

function startTwoStageOrderSimulation(ord) {
  if (localTimers.has(ord.orderId)) clearInterval(localTimers.get(ord.orderId));
  const pCoords = ord.pickupRouteCoords;
  const dCoords = ord.deliverRouteCoords;
  let step = 0;

  const timer = setInterval(() => {
    const layer = orderLayers.get(ord.orderId);
    if (!layer) { clearInterval(timer); return; }

    ord.elapsedSimMin++;
    if (ord.prepRemainingMin > 0) ord.prepRemainingMin--;

    if (ord.stage === 'STANDBY') {
      if (ord.elapsedSimMin >= ord.departAtMin) {
        ord.stage = 'PICKING_UP';
        ord.status = '前往取餐中';
      } else {
        ord.status = `等候出發 (${ord.departAtMin - ord.elapsedSimMin}分後出發)`;
      }
      updateRiderPosition(ord.orderId, ord.riderOrigin[0], ord.riderOrigin[1], 0);
    } else if (ord.stage === 'PICKING_UP') {
      if (step < pCoords.length - 1) {
        const cur = pCoords[step];
        const next = pCoords[step + 1];
        ord.eta = Math.ceil((pCoords.length - step + dCoords.length) * 0.25);
        updateRiderPosition(ord.orderId, cur[0], cur[1], calculateBearing(cur[0], cur[1], next[0], next[1]));
        layer.traveledPolyline.setLatLngs(pCoords.slice(0, step + 1));
        step++;
      } else {
        if (ord.prepRemainingMin > 0) {
          ord.stage = 'WAITING_MEAL';
          ord.status = `🍳 等待備餐中 (${ord.prepRemainingMin} 分鐘)`;
          updateRiderPosition(ord.orderId, ord.restaurant[0], ord.restaurant[1], 0);
        } else {
          ord.stage = 'DELIVERING';
          ord.status = '🍱 配送中';
          step = 0;
          layer.pickupPolyline.setStyle({ opacity: 0.3 });
        }
      }
    } else if (ord.stage === 'WAITING_MEAL') {
      updateRiderPosition(ord.orderId, ord.restaurant[0], ord.restaurant[1], 0);
      if (ord.prepRemainingMin <= 0) {
        ord.stage = 'DELIVERING';
        ord.status = '🍱 配送中';
        step = 0;
        layer.pickupPolyline.setStyle({ opacity: 0.3 });
      }
    } else if (ord.stage === 'DELIVERING') {
      if (step < dCoords.length - 1) {
        const cur = dCoords[step];
        const next = dCoords[step + 1];
        ord.eta = Math.ceil((dCoords.length - step) * 0.25);
        updateRiderPosition(ord.orderId, cur[0], cur[1], calculateBearing(cur[0], cur[1], next[0], next[1]));
        layer.traveledPolyline.setLatLngs([...pCoords, ...dCoords.slice(0, step + 1)]);
        step++;
      } else {
        ord.status = '已送達';
        ord.stage = 'DELIVERED';
        ord.eta = 0;
        updateRiderPosition(ord.orderId, dCoords[dCoords.length - 1][0], dCoords[dCoords.length - 1][1], 0);
        if (layer.userMarker) {
          layer.userMarker.setIcon(L.divIcon({
            className: 'pin',
            html: `<div class="pin-bubble delivered-bubble">🎉</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          }));
        }
        clearInterval(timer);
        localTimers.delete(ord.orderId);
      }
    }

    broadcastOrderUpdate({
      type: 'ORDER_LOCATION_UPDATE',
      orderId: ord.orderId,
      status: ord.status,
      stage: ord.stage,
      eta: ord.eta,
      prepTotalMin: ord.prepTotalMin,
      prepRemainingMin: ord.prepRemainingMin,
      departAtMin: ord.departAtMin,
      elapsedSimMin: ord.elapsedSimMin
    });
  }, 1000);

  localTimers.set(ord.orderId, timer);
}

function updateRiderPosition(orderId, lat, lng, bearing) {
  const layer = orderLayers.get(orderId);
  if (layer?.riderMarker) {
    layer.riderMarker.setLatLng([lat, lng]);
    const navEl = document.getElementById(`rider-admin-nav-${orderId}`);
    if (navEl) navEl.style.transform = `rotate(${bearing}deg)`;
  }
}

function broadcastOrderUpdate(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(payload)); } catch (e) {}
  }
  if (broadcastChannel) {
    try { broadcastChannel.postMessage(payload); } catch (e) {}
  }
}

function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.port === '5173' ? `${window.location.hostname}:3000` : window.location.host;
  try { ws = new WebSocket(`${wsProtocol}//${host}`); } catch (err) {}
}

function removeLayerFromMap(layer) {
  ['riderMarker', 'pickupPolyline', 'deliverPolyline', 'traveledPolyline', 'storeMarker', 'userMarker'].forEach(k => {
    if (layer[k] && map.hasLayer(layer[k])) map.removeLayer(layer[k]);
  });
}

function addLayerToMap(layer) {
  ['pickupPolyline', 'deliverPolyline', 'traveledPolyline', 'storeMarker', 'userMarker', 'riderMarker'].forEach(k => {
    if (layer[k] && !map.hasLayer(layer[k])) map.addLayer(layer[k]);
  });
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

function clearCompleted() {
  const completedIds = orders.filter(o => o.status === '已送達').map(o => o.orderId);
  completedIds.forEach(id => {
    const layer = orderLayers.get(id);
    if (layer) { removeLayerFromMap(layer); orderLayers.delete(id); }
    if (localTimers.has(id)) { clearInterval(localTimers.get(id)); localTimers.delete(id); }
  });
  for (let i = orders.length - 1; i >= 0; i--) {
    if (completedIds.includes(orders[i].orderId)) orders.splice(i, 1);
  }
  if (completedIds.includes(selectedOrderId.value)) {
    selectedOrderId.value = filteredOrders.value.length > 0 ? filteredOrders.value[0].orderId : null;
  }
}

function focusOrder(orderId) {
  selectedOrderId.value = orderId;
  const layer = orderLayers.get(orderId);
  if (layer?.riderMarker) {
    map.panTo(layer.riderMarker.getLatLng(), { animate: true, duration: 0.6 });
  }
}

onUnmounted(() => {
  if (ws) ws.close();
  if (broadcastChannel) broadcastChannel.close();
  localTimers.forEach(t => clearInterval(t));
  if (map) map.remove();
});
</script>

<style scoped>
.admin-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.map-view { width: 100%; height: 100%; }
.nav-bar { position: absolute; top: 14px; right: 14px; z-index: 1000; display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(8px); padding: 6px 14px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); }
.brand { font-weight: 800; font-size: 13px; color: #0f172a; }
.link-driver, .link-mobile { color: #007AFF; font-size: 12px; font-weight: 700; text-decoration: none; }
.link-mobile { color: #10b981; }
.admin-control-panel { position: absolute; top: 58px; right: 14px; z-index: 1000; display: flex; gap: 8px; }
.btn { border: none; border-radius: 20px; padding: 8px 14px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: all 0.2s ease; }
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
.btn-refresh-candidates { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
.btn-dispatch { background: #10b981; color: #ffffff; }
.btn-clear { background: #ffffff; color: #475569; border: 1px solid #e2e8f0; }

:deep(.store-pin-bubble) { color: #ffffff; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); border: 2px solid #ffffff; font-size: 11px; font-weight: 800; white-space: nowrap; }
:deep(.pin-bubble) { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; }
:deep(.pin-bubble.dest-bubble) { width: 28px; height: 28px; }
:deep(.pin-bubble.delivered-bubble) { background: #FF2D55 !important; font-size: 16px; width: 32px; height: 32px; border: 2.5px solid #ffffff; }
:deep(.nav-arrow-bubble) { background: #1e1e1e; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1); }
:deep(.client-radar-wrapper) { position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
:deep(.client-dot) { font-size: 20px; z-index: 2; }
:deep(.client-radar-wave) { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(0, 122, 255, 0.25); border: 1.5px solid #007AFF; animation: radar-wave 2s infinite ease-out; z-index: 1; }
@keyframes radar-wave { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
</style>