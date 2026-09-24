<!-- File: client/src/components/dispatch/StoreMenuModal.vue -->
<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="menu-modal-card">
      <!-- 標題列 -->
      <div class="modal-header">
        <div>
          <div class="badge-category">{{ categoryLabel }}</div>
          <h2 class="store-title">🍽️ {{ storeName }} - 線上點餐</h2>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 菜單主內容 -->
      <div class="modal-body">
        <div v-if="isLoading" class="loading-box">載入菜單中...</div>
        <div v-else class="menu-items-grid">
          <div v-for="item in menuItems" :key="item.id" class="menu-card">
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-desc">{{ item.desc }}</span>
              <span class="item-price">NT$ {{ item.price }}</span>
            </div>
            <div class="item-stepper">
              <button 
                class="step-btn" 
                :disabled="getQuantity(item.id) <= 0" 
                @click="updateQuantity(item, -1)"
              >
                -
              </button>
              <span class="quantity-text">{{ getQuantity(item.id) }}</span>
              <button 
                class="step-btn add" 
                @click="updateQuantity(item, 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 結帳與支付方式區 -->
      <div class="modal-footer">
        <!-- 🌟 支付方式選擇列 (有選餐點時才顯示) -->
        <div class="payment-section" v-if="totalCount > 0">
          <span class="pay-title">付款方式：</span>
          <div class="pay-options">
            <button
              type="button"
              class="pay-chip"
              :class="{ active: selectedPayment === 'CASH' }"
              @click="selectedPayment = 'CASH'"
            >
              💵 現金
            </button>
            <button
              type="button"
              class="pay-chip"
              :class="{ active: selectedPayment === 'LINE_PAY' }"
              @click="selectedPayment = 'LINE_PAY'"
            >
              🟢 LINE Pay
            </button>
            <button
              type="button"
              class="pay-chip"
              :class="{ active: selectedPayment === 'JKOPAY' }"
              @click="selectedPayment = 'JKOPAY'"
            >
              🟠 街口
            </button>
            <button
              type="button"
              class="pay-chip"
              :class="{ active: selectedPayment === 'PXPAY' }"
              @click="selectedPayment = 'PXPAY'"
            >
              🔵 全支付
            </button>
          </div>
        </div>

        <div class="footer-action-row">
          <div class="summary-info">
            <span class="count-hint">已選 {{ totalCount }} 件餐點</span>
            <span class="total-price">小計：<strong>NT$ {{ totalAmount }}</strong></span>
          </div>
          <button 
            class="checkout-btn" 
            :disabled="totalCount === 0" 
            @click="handleCheckout"
          >
            💳 結帳並指派配送 (NT$ {{ totalAmount }})
          </button>
        </div>
      </div>

      <!-- 📱 線上行動支付 QR Code 模擬彈層 -->
      <div v-if="showQrModal" class="qr-overlay">
        <div class="qr-content-card">
          <div class="qr-badge">{{ currentPaymentInfo.name }}</div>
          <h3 class="qr-title">請使用手機掃碼支付</h3>
          
          <div class="qr-code-box">
            <!-- 模擬 SVG QR Code 樣式圖標 -->
            <svg viewBox="0 0 24 24" width="140" height="140" fill="currentColor">
              <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h2v2h-2v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2-2h2v2h-2v-2zm-6-2h2v2h-2v-2zm0 4h2v2h-2v-2zm6-10h2v2h-2V6zm-2 2h2v2h-2V8zm2 2h2v2h-2v-2zm2-2h2v2h-2V8zm-2 4h2v2h-2v-2z"/>
            </svg>
          </div>

          <div class="qr-pay-amount">
            應付金額：<strong>NT$ {{ totalAmount }}</strong>
          </div>
          <span class="qr-subtext">支援街口/LINE Pay/全支付 App 掃描扣款</span>

          <div class="qr-actions">
            <button class="qr-btn cancel" @click="showQrModal = false">返回修改</button>
            <button class="qr-btn confirm" @click="confirmQrPayment">
              ✅ 已完成付款，立即派送
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { getApiBase } from '@/utils/geoUtils';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  store: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'confirm-order']);

const isLoading = ref(false);
const menuItems = ref([]);
const categoryLabel = ref('精選便當快餐');
const cart = ref({});

// 🌟 支付狀態與 QR Code 控制
const selectedPayment = ref('CASH');
const showQrModal = ref(false);

const PAYMENT_INFO = {
  CASH: { name: '💵 現金支付', isOnline: false },
  LINE_PAY: { name: '🟢 LINE Pay', isOnline: true },
  JKOPAY: { name: '🟠 街口支付', isOnline: true },
  PXPAY: { name: '🔵 全支付', isOnline: true }
};

const currentPaymentInfo = computed(() => {
  return PAYMENT_INFO[selectedPayment.value] || PAYMENT_INFO.CASH;
});

const storeName = computed(() => props.store?.name || '指定店家');

// 預設備份菜單（防止後台異常時完全空白）
const DEFAULT_FALLBACK_MENU = [
  { id: 'b1', name: '黃金酥脆炸雞腿便當', price: 120, desc: '皮脆多汁大雞腿，附三樣當日現炒配菜' },
  { id: 'b2', name: '古早味厚切排骨便當', price: 110, desc: '秘製滷汁醃製後酥炸，鹹香下飯' },
  { id: 'b3', name: '醬燒無骨烤雞排飯', price: 115, desc: '特調蜜汁照燒醬慢火烘烤' },
  { id: 'b4', name: '清蒸甘甜鱈魚排飯', price: 130, desc: '清爽無負擔，肉質細緻嫩滑' }
];

watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      cart.value = {};
      showQrModal.value = false;
      await fetchMenu(props.store);
    }
  },
  { immediate: true }
);

async function fetchMenu(store) {
  isLoading.value = true;
  try {
    const sName = store?.name || '';
    const sCat = store?.category || '';
    const res = await fetch(`${getApiBase()}/api/menu?storeName=${encodeURIComponent(sName)}&category=${encodeURIComponent(sCat)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        menuItems.value = data.items;
        categoryLabel.value = data.categoryLabel || '精選推薦';
        return;
      }
    }
    menuItems.value = DEFAULT_FALLBACK_MENU;
  } catch (err) {
    console.error('[fetchMenu] 讀取失敗，使用備用菜單:', err);
    menuItems.value = DEFAULT_FALLBACK_MENU;
  } finally {
    isLoading.value = false;
  }
}

function getQuantity(itemId) {
  return cart.value[itemId]?.count || 0;
}

function updateQuantity(item, delta) {
  const current = getQuantity(item.id);
  const next = Math.max(0, current + delta);
  if (next === 0) {
    delete cart.value[item.id];
  } else {
    cart.value[item.id] = { item, count: next };
  }
}

const totalCount = computed(() => {
  return Object.values(cart.value).reduce((sum, entry) => sum + entry.count, 0);
});

const totalAmount = computed(() => {
  return Object.values(cart.value).reduce((sum, entry) => sum + entry.item.price * entry.count, 0);
});

// 點選結帳：如果是行動支付先跳出 QR Code，如果是現金就直接下單
function handleCheckout() {
  if (totalCount.value === 0) return;

  if (currentPaymentInfo.value.isOnline) {
    showQrModal.value = true;
    return;
  }

  submitOrder();
}

// 掃碼確認後下單
function confirmQrPayment() {
  showQrModal.value = false;
  submitOrder();
}

// 統一觸發確認訂單事件
function submitOrder() {
  const items = Object.values(cart.value).map((e) => ({
    name: e.item.name,
    price: e.item.price,
    count: e.count
  }));

  emit('confirm-order', {
    items,
    itemTotal: totalAmount.value,
    totalCount: totalCount.value,
    paymentMethod: selectedPayment.value,
    paymentLabel: currentPaymentInfo.value.name
  });
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.menu-modal-card {
  width: 100%;
  max-width: 520px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  position: relative;
  overflow: hidden;
  animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: #0f172a;
}
.badge-category {
  font-size: 11px;
  color: #38bdf8;
  font-weight: 700;
  margin-bottom: 4px;
}
.store-title {
  margin: 0;
  font-size: 16px;
  color: #f8fafc;
  font-weight: 800;
}
.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}
.close-btn:hover {
  color: #ffffff;
}

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.loading-box {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
}
.menu-items-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 12px 14px;
}
.item-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item-name {
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}
.item-desc {
  font-size: 11px;
  color: #94a3b8;
}
.item-price {
  font-size: 13px;
  color: #f59e0b;
  font-weight: 800;
  margin-top: 2px;
}

.item-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e293b;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid #334155;
}
.step-btn {
  width: 26px;
  height: 26px;
  background: #334155;
  border: none;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.step-btn.add {
  background: #0284c7;
}
.step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.quantity-text {
  min-width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 800;
  color: #f8fafc;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #334155;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payment-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pay-title {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
}
.pay-options {
  display: flex;
  gap: 6px;
  flex: 1;
}
.pay-chip {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pay-chip:hover {
  background: #334155;
}
.pay-chip.active {
  background: rgba(2, 132, 199, 0.25);
  border-color: #38bdf8;
  color: #38bdf8;
}

.footer-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.summary-info {
  display: flex;
  flex-direction: column;
}
.count-hint {
  font-size: 11px;
  color: #94a3b8;
}
.total-price {
  font-size: 13px;
  color: #f8fafc;
}
.total-price strong {
  font-size: 16px;
  color: #10b981;
}

.checkout-btn {
  flex: 1;
  max-width: 260px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  padding: 11px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transition: all 0.15s ease;
}
.checkout-btn:disabled {
  opacity: 0.4;
  box-shadow: none;
  cursor: not-allowed;
}
.checkout-btn:not(:disabled):hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

/* 🌟 QR Code 掃碼彈層樣式 */
.qr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(6px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.qr-content-card {
  background: #1e293b;
  border: 1px solid #38bdf8;
  border-radius: 14px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.qr-badge {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  padding: 3px 10px;
  border-radius: 20px;
}
.qr-title {
  margin: 0;
  font-size: 15px;
  color: #f8fafc;
}
.qr-code-box {
  background: #ffffff;
  color: #0f172a;
  padding: 14px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  margin: 4px 0;
}
.qr-pay-amount {
  font-size: 13px;
  color: #cbd5e1;
}
.qr-pay-amount strong {
  font-size: 18px;
  color: #10b981;
}
.qr-subtext {
  font-size: 10px;
  color: #64748b;
}
.qr-actions {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
}
.qr-btn {
  flex: 1;
  padding: 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
}
.qr-btn.cancel {
  background: #334155;
  color: #cbd5e1;
}
.qr-btn.confirm {
  background: #10b981;
  color: #ffffff;
}
</style>