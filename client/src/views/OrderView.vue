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
          :isAddressLocked="hasActiveDelivery"
          :hasCustomerCoord="!!targetCustomerCoord"
          :orderCart="currentCart"
          :getStoreKey="getStoreKey"
          :getDisplayCategory="getDisplayCategory"
          @update:category="handleCategoryChange"
          @store-change="handleStoreChange"
          @open-menu="handleOpenMenu"
          @reopen-menu="isMenuModalVisible = true"
          @geocode="handleManualGeocode"
          @dispatch="executeDispatch"
        />

        <OrderTaskList 
          :orders="orders" 
          @clear-completed="handleClearCompletedOrders"
        />
      </aside>

      <!-- 右側大地圖模組 -->
      <OrderMap
        ref="orderMapRef"
        :targetCustomerCoord="targetCustomerCoord"
        :customerAddress="customerAddressInput"
        @map-click="handleMapClick"
      />
    </div>

    <!-- 🍽️ 店家專屬線上菜單點餐彈窗 -->
    <StoreMenuModal
      :visible="isMenuModalVisible"
      :store="activeStore"
      @close="isMenuModalVisible = false"
      @confirm-order="handleConfirmAndDispatch"
    />

    <!-- 🛵 右側待確認卡片清單 (排成一排縱向堆疊) -->
    <div class="confirm-toasts-container">
      <transition-group name="toast-slide">
        <div 
          v-for="item in pendingConfirms" 
          :key="item.orderId" 
          class="cash-toast-card"
        >
          <div class="toast-header">
            <span class="toast-title">🛵 餐點已送達門口！</span>
            <button class="toast-close" @click="dismissToast(item.orderId)">✕</button>
          </div>
          <div class="toast-body">
            <p class="toast-store">店家：<strong>{{ item.storeName }}</strong></p>
            <div class="toast-cash-badge" v-if="item.isCash">
              💵 請備妥現金：<strong>NT$ {{ item.amount }}</strong>
            </div>
            <div class="toast-tip">
              ⏱️ 15 分鐘未手動確認，系統將自動確認完成。
            </div>
            <button class="toast-confirm-btn" @click="handleManualConfirm(item.orderId)">
              ✅ 我已收到餐點 (確認收餐)
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getApiBase } from '@/utils/geoUtils';
import { useRestaurantFilter } from '@/composables/useRestaurantFilter';
import { useOrderDispatch } from '@/composables/useOrderDispatch';
import DispatchForm from '@/components/dispatch/DispatchForm.vue';
import OrderTaskList from '@/components/dispatch/OrderTaskList.vue';
import OrderMap from '@/components/dispatch/OrderMap.vue';
import StoreMenuModal from '@/components/dispatch/StoreMenuModal.vue';

const orderMapRef = ref(null);
const customerAddressInput = ref('');

// 菜單彈窗與購物車狀態
const isMenuModalVisible = ref(false);
const currentCart = ref(null);

// 🌟 右側待確認卡片清單與 15 分鐘計時器 Map
const pendingConfirms = ref([]);
const confirmTimers = new Map();

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

// 當前選中的店家物件
const activeStore = computed(() => {
  return restaurants.value.find((s) => getStoreKey(s) === String(selectedStoreId.value)) || null;
});

// 判斷是否有尚未送達的外送任務
const hasActiveDelivery = computed(() => {
  return orders.value.some((o) => o.status !== '已送達' && o.stage !== 'DELIVERED');
});

onMounted(async () => {
  await Promise.all([loadRestaurants(), loadRiders()]);
});

function handleCategoryChange(cat) {
  selectedStoreId.value = '';
  currentCart.value = null;
  orderMapRef.value?.clearPreviewStore();
  setCategory(cat);
}

function handleStoreChange() {
  const store = activeStore.value;
  if (store) {
    orderMapRef.value?.showPreviewStore(getValidCoord(store), store.name, store.address);
  } else {
    orderMapRef.value?.clearPreviewStore();
  }
}

// 點選店家下拉選單時，直接彈出菜單
function handleOpenMenu() {
  currentCart.value = null;
  if (activeStore.value) {
    isMenuModalVisible.value = true;
  }
}

// 菜單結帳確認：直接發動配送
function handleConfirmAndDispatch(cartData) {
  currentCart.value = cartData;

  if (!targetCustomerCoord.value) {
    alert('⚠️ 請先在右側地圖點擊任一點，或輸入外送地址設定「送達點」，系統即可為您指派配送！');
    isMenuModalVisible.value = false;
    return;
  }

  isMenuModalVisible.value = false;
  executeDispatch();
}

function setCustomerDestination(coord, address) {
  targetCustomerCoord.value = coord;
  if (address) customerAddressInput.value = address;
  orderMapRef.value?.showPreviewCustomer(coord, customerAddressInput.value);

  if (selectedStoreId.value) {
    handleStoreChange();
  }
}

async function handleManualGeocode() {
  if (hasActiveDelivery.value) {
    alert('⚠️ 配送進行中外送地址已鎖定，無法變更！');
    return;
  }
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
  if (hasActiveDelivery.value) {
    alert('⚠️ 目前已有配送任務進行中，外送地址已鎖定，暫無法變更！');
    return;
  }

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

// 🌟 關閉單筆右側卡片
function dismissToast(orderId) {
  pendingConfirms.value = pendingConfirms.value.filter((c) => c.orderId !== orderId);
}

// 🌟 點擊確認收餐：右側卡片消失，左側任務列表更新為「已確認」
function handleManualConfirm(orderId) {
  const target = orders.value.find((o) => o.orderId === orderId);
  if (target) {
    target.confirmStatus = 'MANUAL_CONFIRMED';
    target.status = '已確認';
  }

  // 清除計時器
  if (confirmTimers.has(orderId)) {
    clearTimeout(confirmTimers.get(orderId));
    confirmTimers.delete(orderId);
  }

  dismissToast(orderId);
}

// 🌟 外送員抵達觸發：推入右側待確認卡片，並啟動 15 分鐘計時
function onOrderDelivered(orderId, currentPayment, itemTotal, storeName) {
  const finishedOrder = orders.value.find((o) => o.orderId === orderId);
  if (!finishedOrder) return;

  // 1. 任務列表狀態設為「待確認」
  finishedOrder.confirmStatus = null;
  finishedOrder.status = '待確認';

  const totalAmount = finishedOrder.totalBill || ((finishedOrder.deliveryFee || 49) + itemTotal);
  const isCash = (finishedOrder.paymentMethod || currentPayment) === 'CASH';

  // 2. 加入右側排隊清單
  pendingConfirms.value.push({
    orderId,
    storeName: finishedOrder.storeName || storeName,
    isCash,
    amount: totalAmount
  });

  // 3. 15 分鐘計時器：超時自動確認並移除卡片
  const timer = setTimeout(() => {
    if (finishedOrder && !finishedOrder.confirmStatus) {
      finishedOrder.confirmStatus = 'AUTO_CONFIRMED';
      finishedOrder.status = '自動確認';
      dismissToast(orderId);
      confirmTimers.delete(orderId);
      console.log(`[Auto Confirm] 訂單 ${orderId} 逾 15 分鐘未手動核對，已自動確認完成。`);
    }
  }, 15 * 60 * 1000);

  confirmTimers.set(orderId, timer);
}

// 執行派單核心函式
function executeDispatch() {
  const store = activeStore.value;
  if (!store || !targetCustomerCoord.value || !currentCart.value) return;

  const currentPayment = currentCart.value.paymentMethod || 'CASH';
  const currentPayLabel = currentCart.value.paymentLabel || '💵 現金支付';
  const itemTotal = currentCart.value.itemTotal || 0;

  createAndDispatchOrder({
    store,
    storeCoord: getValidCoord(store),
    customerCoord: targetCustomerCoord.value,
    customerAddress: customerAddressInput.value,
    items: currentCart.value.items || [],
    itemTotal: itemTotal,
    paymentMethod: currentPayment,
    paymentLabel: currentPayLabel,
    onOrderCreated: (newOrder) => {
      newOrder.paymentMethod = currentPayment;
      newOrder.paymentLabel = currentPayLabel;
      newOrder.totalBill = (newOrder.deliveryFee || 49) + itemTotal;

      orderMapRef.value?.addOrderLayer(newOrder);
      resetDispatchForm();
    },
    onRiderStep: (orderId, curCoord, traveledCoords, isDelivered, isPickedUp) => {
      orderMapRef.value?.updateRiderStep(orderId, curCoord, traveledCoords, isDelivered, isPickedUp);

      // 🌟 送達當下加入右側排隊確認
      if (isDelivered) {
        onOrderDelivered(orderId, currentPayment, itemTotal, store.name);
      }
    }
  });
}

// 派單完成後保留地址與座標
function resetDispatchForm() {
  selectedStoreId.value = '';
  currentCart.value = null;

  orderMapRef.value?.clearPreviewStore();

  if (!hasActiveDelivery.value) {
    customerAddressInput.value = '';
    targetCustomerCoord.value = null;
    if (orderMapRef.value?.clearPreviewCustomer) {
      orderMapRef.value.clearPreviewCustomer();
    }
  }
}

// 🌟 嚴格檢查：只有「已確認」或「自動確認」的訂單才允許清除，「待確認」必須保留！
function handleClearCompletedOrders() {
  // 1. 嚴格過濾：必須有明確的確認狀態 (手動確認 或 逾時自動確認)
  const completedOrders = orders.value.filter(
    (o) =>
      o.confirmStatus === 'MANUAL_CONFIRMED' ||
      o.confirmStatus === 'AUTO_CONFIRMED' ||
      o.status === '已確認' ||
      o.status === '自動確認'
  );
  const completedIds = completedOrders.map((o) => o.orderId);

  if (completedIds.length === 0) return;

  // 2. 地圖只清除這幾筆真正確認完畢的訂單圖層
  if (orderMapRef.value?.removeOrderLayers) {
    orderMapRef.value.removeOrderLayers(completedIds);
  }

  // 3. 任務列表只保留尚未確認 (包含配送中、待確認) 的訂單
  const completedIdSet = new Set(completedIds);
  orders.value = orders.value.filter((o) => !completedIdSet.has(o.orderId));

  // 4. 若當前沒有任何配送中訂單，才解鎖目的地
  if (!hasActiveDelivery.value) {
    customerAddressInput.value = '';
    targetCustomerCoord.value = null;
    orderMapRef.value?.clearPreviewCustomer?.();
  }
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

/* 🌟 右側待確認卡片容器 (縱向堆疊排成一排) */
.confirm-toasts-container {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 90px);
  overflow-y: auto;
  pointer-events: none; /* 空白區不擋地圖操作 */
}

.cash-toast-card {
  pointer-events: auto; /* 卡片本體可點擊 */
  width: 320px;
  background: #1e293b;
  border: 1px solid #10b981;
  border-left: 5px solid #10b981;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 12px rgba(16, 185, 129, 0.2);
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.toast-title {
  font-size: 13px;
  font-weight: 800;
  color: #34d399;
}
.toast-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
}
.toast-close:hover {
  color: #ffffff;
}

.toast-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.toast-store {
  margin: 0;
  font-size: 12px;
  color: #f8fafc;
}
.toast-cash-badge {
  background: rgba(16, 185, 129, 0.15);
  border: 1px dashed #10b981;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: #f8fafc;
}
.toast-cash-badge strong {
  font-size: 14px;
  color: #10b981;
}
.toast-tip {
  font-size: 10px;
  color: #94a3b8;
}
.toast-confirm-btn {
  margin-top: 4px;
  width: 100%;
  background: #10b981;
  color: #ffffff;
  border: none;
  font-size: 12px;
  font-weight: 800;
  padding: 8px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.toast-confirm-btn:hover {
  background: #059669;
}

/* 🌟 卡片滑入/消失動畫 */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.9);
}
</style>