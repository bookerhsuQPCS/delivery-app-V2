<!-- File: src/components/dispatch/OrderTaskList.vue -->
<template>
  <div class="control-card orders-list-box">
    <div class="card-title flex-between">
      <span>📋 當前任務列表</span>
      <span class="badge">{{ orders.length }} 單</span>
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
          <div class="order-status-badge" :class="getStatusBadgeClass(ord.stage)">
            {{ ord.status }}
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
defineProps({
  orders: {
    type: Array,
    default: () => []
  }
});

function getStatusBadgeClass(stage) {
  if (stage === 'ASSIGNED_HOLD') return 'badge-hold';
  if (stage === 'PICKING_UP') return 'badge-pickup';
  if (stage === 'DELIVERING') return 'badge-deliver';
  if (stage === 'DELIVERED') return 'badge-done';
  return 'badge-default';
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
.badge {
  background: #334155;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #cbd5e1;
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
</style>