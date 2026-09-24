<!-- File: src/components/dispatch/OrderTaskList.vue -->
<template>
  <div class="control-card orders-list-box">
    <div class="card-title flex-between">
      <div class="title-left">
        <span>📋 當前任務列表</span>
        <span class="badge">{{ orders.length }} 單</span>
      </div>

      <!-- 🌟 有已送達單時才顯示清除按鈕 -->
      <button
        v-if="completedCount > 0"
        class="clean-btn"
        @click="$emit('clear-completed')"
        title="清除所有已送達的訂單與地圖軌跡"
      >
        🧹 清除已送達 ({{ completedCount }})
      </button>
    </div>

    <div v-if="orders.length === 0" class="empty-state">
      目前無進行中的外送任務，請在上方建立派單。
    </div>

    <div class="orders-scroll-list" v-else>
      <div
        v-for="ord in orders"
        :key="ord.orderId"
        class="order-item-card"
        :class="{ 'is-completed': ord.status === '已送達' }"
      >
        <div class="order-item-header">
          <span class="order-id-tag">{{ ord.orderId }}</span>
          <span class="order-fee">${{ ord.deliveryFee }}</span>
        </div>

        <div class="order-route-desc">
          <div class="route-line">
            <span class="dot store-dot"></span>
            <span class="name">{{ ord.storeName }}</span>
          </div>
          <div class="route-line">
            <span class="dot client-dot"></span>
            <span class="name">{{ ord.address }}</span>
          </div>
        </div>

        <div class="order-rider-info">
          <div class="rider-name">
            <span>{{ ord.rider?.avatar || '🛵' }}</span>
            <strong>{{ ord.rider?.name }}</strong>
            <span class="rider-vehicle">({{ ord.rider?.vehicle || '機車' }})</span>
          </div>
          <div class="order-status-badge" :class="getStatusBadgeClass(ord)">
            {{ getDisplayStatus(ord) }}
          </div>
        </div>

        <!-- 階段進度條 -->
        <div class="order-progress-track">
          <div 
            class="progress-fill" 
            :style="{ width: getOrderProgressWidth(ord), background: ord.color }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  orders: {
    type: Array,
    default: () => []
  }
});

defineEmits(['clear-completed', 'confirm-received']);

// 🌟 包含「已送達」、「已確認」或「自動確認」的訂單
const completedCount = computed(() => {
  return props.orders.filter(
    (o) =>
      o.status === '已送達' ||
      o.status === '已確認' ||
      o.status === '自動確認' ||
      o.confirmStatus === 'MANUAL_CONFIRMED' ||
      o.confirmStatus === 'AUTO_CONFIRMED'
  ).length;
});

function getStatusBadgeClass(ord) {
  if (ord.confirmStatus === 'MANUAL_CONFIRMED') return 'badge-confirmed';
  if (ord.confirmStatus === 'AUTO_CONFIRMED') return 'badge-auto';
  if (ord.stage === 'DELIVERED' || ord.status === '待確認' || ord.status === '已送達') return 'badge-pending-confirm';
  if (ord.stage === 'ASSIGNED_HOLD') return 'badge-hold';
  if (ord.stage === 'PICKING_UP') return 'badge-pickup';
  if (ord.stage === 'DELIVERING') return 'badge-deliver';
  return 'badge-default';
}

function getDisplayStatus(ord) {
  if (ord.confirmStatus === 'MANUAL_CONFIRMED' || ord.status === '已確認') return '✅ 已確認';
  if (ord.confirmStatus === 'AUTO_CONFIRMED' || ord.status === '自動確認') return '🤖 自動確認';
  if (ord.stage === 'DELIVERED' || ord.status === '待確認' || ord.status === '已送達') return '⏳ 待確認';
  return ord.status;
}

function getOrderProgressWidth(ord) {
  if (ord.stage === 'ASSIGNED_HOLD') return '8%';
  if (ord.stage === 'PICKING_UP') return '40%';
  if (ord.stage === 'DELIVERING') return '75%';
  if (ord.stage === 'DELIVERED') return '100%';
  return '5%';
}
</script>

<style scoped>
.control-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 14px;
}
.card-title {
  font-size: 13px;
  font-weight: 800;
  color: #38bdf8;
  margin-bottom: 12px;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge {
  background: #334155;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #cbd5e1;
}

/* 🌟 清除已送達紅色微光按鈕 */
.clean-btn {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.clean-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

.orders-list-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.orders-scroll-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty-state {
  font-size: 12px;
  color: #64748b;
  text-align: center;
  padding: 24px 0;
}
.order-item-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.order-item-card.is-completed {
  opacity: 0.7;
  border-color: #10b981;
}
.order-item-header {
  display: flex;
  justify-content: space-between;
  font-weight: 800;
}
.order-id-tag {
  color: #94a3b8;
}
.order-fee {
  color: #10b981;
  font-size: 13px;
}

.order-route-desc .route-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.store-dot {
  background: #0284c7;
}
.client-dot {
  background: #ef4444;
}
.order-route-desc .name {
  color: #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.order-rider-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  border-top: 1px dashed #334155;
  padding-top: 6px;
}
.rider-name strong {
  color: #fff;
  margin-left: 4px;
}
.rider-vehicle {
  color: #64748b;
  font-size: 10px;
  margin-left: 2px;
}

.order-status-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
}
.badge-hold {
  background: #854d0e;
  color: #fde047;
  animation: pulseGlow 1s infinite alternate;
}
.badge-pickup {
  background: #1e3a8a;
  color: #93c5fd;
}
.badge-deliver {
  background: #164e63;
  color: #67e8f9;
}
.badge-done {
  background: #065f46;
  color: #34d399;
}

@keyframes pulseGlow {
  from {
    opacity: 0.6;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1.03);
  }
}

.order-progress-track {
  height: 4px;
  background: #0f172a;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}
.progress-fill {
  height: 100%;
  transition: width 0.3s;
}
/* 狀態標籤樣式 */
.badge-pending-confirm {
  background: #b45309;
  color: #fef08a;
  animation: pulseGlow 1s infinite alternate;
}
.badge-confirmed {
  background: #065f46;
  color: #34d399;
}
.badge-auto {
  background: #1e3a5f;
  color: #38bdf8;
}

/* 待確認操作列 */
.confirm-action-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px dashed #eab308;
  margin-top: 4px;
}
.countdown-hint {
  font-size: 11px;
  color: #facc15;
}
.manual-confirm-btn {
  background: #10b981;
  color: #ffffff;
  border: none;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.manual-confirm-btn:hover {
  background: #059669;
}
</style>