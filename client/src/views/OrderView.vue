<!-- File: client/src/views/OrderView.vue -->
<template>
  <div class="admin-container">
    <!-- 頂部導航列 -->
    <header class="admin-header">
      <div class="header-brand">
        <span class="brand-icon">🛵</span>
        <div>
          <h1 class="brand-title">外送調度總控台 (Order View)</h1>
          <span class="brand-subtitle">即時路網規劃 · 智慧動態指派 · 訂單追蹤</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="nav-btn monitor-link" @click="openMonitorTab">
          🖥️ 軌跡監控中心 ↗
        </button>
      </div>
    </header>

    <div class="admin-main">
      <!-- 左側操作與清單區 -->
      <aside class="sidebar-panel">
        <DispatchForm
          v-model="selectedStoreId"
          v-model:addressInput="customerAddressInput"
          :stores="filteredRestaurants"
          :totalStoresCount="restaurants.length"
          :selectedCategory="selectedCategoryFilter"
          :isDispatching="isDispatching"
          :hasCustomerCoord="!!targetCustomerCoord"
          :getStoreKey="getStoreKey"
          :getDisplayCategory="getDisplayCategory"
          @update:category="handleCategoryChange"
          @store-change="handleStoreChange"
          @geocode="handleManualGeocode"
          @dispatch="handleDispatch"
        />

        <OrderTaskList :orders="orders" />
      </aside>

      <!-- 右側大地圖模組 -->
      <OrderMap
        ref="orderMapRef"
        :targetCustomerCoord="targetCustomerCoord"
        :customerAddress="customerAddressInput"
        @map-click="handleMapClick"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getApiBase } from '@/utils/geoUtils';
import { useRestaurantFilter } from '@/composables/useRestaurantFilter';
import { useOrderDispatch } from '@/composables/useOrderDispatch';
import DispatchForm from '@/components/dispatch/DispatchForm.vue';
import OrderTaskList from '@/components/dispatch/OrderTaskList.vue';
import OrderMap from '@/components/dispatch/OrderMap.vue';

const orderMapRef = ref(null);
const customerAddressInput = ref('');

const {
  restaurants,
  selectedCategoryFilter,
  selectedStoreId,
  targetCustomerCoord,
  filteredRestaurants,
  getStoreKey,
  getValidCoord,
  getDisplayCategory,
  loadRestaurants,
  setCategory
} = useRestaurantFilter();

const {
  orders,
  isDispatching,
  loadRiders,
  createAndDispatchOrder
} = useOrderDispatch();

onMounted(async () => {
  await Promise.all([loadRestaurants(), loadRiders()]);
});

function handleCategoryChange(cat) {
  // 切換類別時，清空當前店家選擇，不自動 default
  selectedStoreId.value = '';
  orderMapRef.value?.clearPreviewStore();
  setCategory(cat);
}

function handleStoreChange() {
  const store = restaurants.value.find(s => getStoreKey(s) === String(selectedStoreId.value));
  if (store) {
    orderMapRef.value?.showPreviewStore(getValidCoord(store), store.name, store.address);
  } else {
    orderMapRef.value?.clearPreviewStore();
  }
}

function setCustomerDestination(coord, address) {
  targetCustomerCoord.value = coord;
  if (address) customerAddressInput.value = address;
  orderMapRef.value?.showPreviewCustomer(coord, customerAddressInput.value);

  // 🌟 重要：不自動預設店家，使用者必須自己挑選
  if (selectedStoreId.value) {
    handleStoreChange();
  }
}

async function handleManualGeocode() {
  if (!customerAddressInput.value.trim()) return;
  try {
    const res = await fetch(`${getApiBase()}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: customerAddressInput.value })
    });
    const data = await res.json();
    let resolved = null;
    if (data.coords && Array.isArray(data.coords)) resolved = [Number(data.coords[0]), Number(data.coords[1])];
    else if (data.lat && data.lng) resolved = [Number(data.lat), Number(data.lng)];

    if (resolved) {
      setCustomerDestination(resolved, data.displayName || customerAddressInput.value);
    } else {
      alert('無法定位該地址，請嘗試輸入更具體之路名或直接點擊地圖！');
    }
  } catch (e) {
    console.error('地址定位解析失敗:', e);
  }
}

async function handleMapClick(latlng) {
  const coord = [latlng.lat, latlng.lng];
  setCustomerDestination(coord, '解析地址中...');
  try {
    const res = await fetch(`${getApiBase()}/api/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: latlng.lat, lng: latlng.lng })
    });
    const data = await res.json();
    if (data.address) customerAddressInput.value = data.address;
  } catch (err) {
    customerAddressInput.value = `雙北座標 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
  }
}

function handleDispatch() {
  let currentStore = restaurants.value.find(s => getStoreKey(s) === String(selectedStoreId.value));
  if (!currentStore || !targetCustomerCoord.value) return;

  createAndDispatchOrder({
    store: currentStore,
    storeCoord: getValidCoord(currentStore),
    customerCoord: targetCustomerCoord.value,
    customerAddress: customerAddressInput.value,
    onOrderCreated: (newOrder) => {
      orderMapRef.value?.addOrderLayer(newOrder);
    },
    onRiderStep: (orderId, curCoord, traveledCoords, isDelivered, isPickedUp) => {
      orderMapRef.value?.updateRiderStep(orderId, curCoord, traveledCoords, isDelivered, isPickedUp);
    }
  });
}

function openMonitorTab() {
  window.open('/monitor', '_blank');
}
</script>

<style scoped>
.admin-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #f8fafc;
}
.admin-header {
  height: 56px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 20;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-icon {
  font-size: 24px;
}
.brand-title {
  font-size: 16px;
  font-weight: 800;
  color: #38bdf8;
  margin: 0;
}
.brand-subtitle {
  font-size: 11px;
  color: #94a3b8;
}
.nav-btn.monitor-link {
  background: #0284c7;
  color: #fff;
  border: none;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-btn.monitor-link:hover {
  background: #0369a1;
}

.admin-main {
  flex: 1;
  display: flex;
  height: calc(100vh - 56px);
}
.sidebar-panel {
  width: 380px;
  height: 100%;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  overflow-y: auto;
}
</style>