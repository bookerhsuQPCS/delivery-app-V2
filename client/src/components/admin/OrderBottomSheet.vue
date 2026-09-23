<!-- File: client/src/components/admin/OrderBottomSheet.vue -->
<template>
  <div class="bottom-sheet">
    <div class="sheet-handle"></div>
    <div v-if="filteredOrders.length === 0" class="empty-hint">
      {{ selectedRiderName ? `【${selectedRiderName}】目前無負責訂單` : '請輸入雙北外送地址，挑選取餐商家後，點擊「🍳 備餐與指派」開始調度' }}
    </div>
    <div v-else class="orders-list">
      <div 
        v-for="order in filteredOrders" 
        :key="order.orderId" 
        class="order-item" 
        :class="{ active: selectedOrderId === order.orderId, isDelivered: order.status === '已送達' }"
        @click="$emit('focus-order', order.orderId)"
      >
        <div class="order-color-dot" :style="{ background: order.color }"></div>
        <div class="order-info">
          <div class="order-header-line">
            <div class="title-with-tags">
              <span class="order-title">{{ order.name }}</span>
              <span class="category-pill">{{ order.storeCategory }}</span>
              <span v-if="order.surcharge > 0" class="surcharge-log-tag">稍遠外送 +${{ order.surcharge }}</span>
            </div>
            <span class="status-badge" :class="getOrderStatusClass(order.status)">
              {{ order.status }}
            </span>
          </div>

          <div class="order-rider-chip" v-if="order.rider">
            <span class="rider-chip-avatar">{{ order.rider.avatar }}</span>
            <span class="rider-chip-name">{{ order.rider.name }} ({{ order.rider.vehicle }})</span>
            <span class="rider-chip-rating">★ {{ order.rider.rating }}</span>
          </div>

          <div class="two-stage-stepper">
            <span class="step-badge" :class="{ active: order.stage === 'PICKING_UP' || order.status === '前往取餐中' }">
              階段 1: 取餐 ({{ order.pickupDistKm || '0.0' }}km)
            </span>
            <span class="step-divider">➔</span>
            <span class="step-badge" :class="{ active: order.stage === 'DELIVERING' || order.status === '外送配送中' }">
              階段 2: 送餐 ({{ order.deliverDistKm || '0.0' }}km)
            </span>
          </div>

          <div class="order-address-text">
            🏪 取自：<b>{{ order.storeName }}</b> ➔ 📍 送往：<b>{{ order.address }}</b>
          </div>

          <div class="order-meta">
            <span v-if="order.status !== '已送達'">
              ⏳ 預估 <b>{{ order.eta }}</b> 分鐘 · 總程 <b>{{ order.totalDistanceKm }}</b> km · 💰 外送費 <b>${{ order.deliveryFee }}</b>
            </span>
            <span v-else class="delivered-text">
              🎉 餐點已送達！(外送費: ${{ order.deliveryFee }})
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  filteredOrders: Array,
  selectedOrderId: String,
  selectedRiderName: String
});

defineEmits(['focus-order']);

function getOrderStatusClass(status) {
  if (status === '已送達') return 'delivered';
  if (status.includes('等候出發')) return 'standby';
  if (status.includes('等待備餐')) return 'waiting';
  if (status.includes('前往取餐')) return 'picking';
  return 'delivering';
}
</script>

<style scoped>
.bottom-sheet { position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000; background: #ffffff; border-top-left-radius: 24px; border-top-right-radius: 24px; padding: 12px 16px 20px; box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12); max-height: 260px; overflow-y: auto; }
.sheet-handle { width: 36px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 0 auto 10px; }
.empty-hint { text-align: center; font-size: 13px; color: #888; padding: 18px 0; }
.orders-list { display: flex; flex-direction: column; gap: 8px; }
.order-item { display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; border-radius: 12px; background: #f8f9fa; cursor: pointer; border: 1px solid #e2e8f0; }
.order-item.active { background: #eef7ff; border-color: #007AFF; }
.order-item.isDelivered { background: #fffafa; border-color: #ffccd5; }
.order-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.order-info { flex: 1; }
.order-header-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
.title-with-tags { display: flex; align-items: center; gap: 6px; }
.order-title { font-size: 13px; font-weight: 800; color: #1e293b; }
.category-pill { font-size: 9px; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 1px 5px; border-radius: 4px; }
.surcharge-log-tag { font-size: 9px; font-weight: 800; background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5; padding: 1px 5px; border-radius: 4px; }
.order-rider-chip { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 11px; margin: 2px 0 4px; color: #334155; }
.two-stage-stepper { display: flex; align-items: center; gap: 6px; margin: 3px 0 5px; }
.step-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #64748b; font-weight: 700; }
.step-badge.active { background: #007AFF; color: #ffffff; }
.step-divider { font-size: 10px; color: #94a3b8; }
.order-address-text { font-size: 12px; color: #334155; margin-bottom: 4px; }
.order-meta { font-size: 12px; color: #64748b; }
.delivered-text { color: #FF2D55; font-weight: 800; }
.status-badge { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.status-badge.picking { background: #e0f2fe; color: #0284c7; }
.status-badge.delivering { background: #e6f9f0; color: #06C167; }
.status-badge.delivered { background: #FFEBEF; color: #FF2D55; border: 1px solid #FF3B30; }
</style>