<!-- File: client/src/components/dispatch/DispatchForm.vue -->
<template>
  <div class="control-card dispatch-box">
    <div class="card-title">📦 建立模擬派送單</div>

    <!-- 步驟 1: 外送地址放上面 -->
    <div class="form-group">
      <label>
        1. 外送地址 (門牌 / 地標)
        <span v-if="isAddressLocked" class="locked-badge">🔒 配送中已鎖定目的地</span>
      </label>
      <div class="input-with-btn">
        <input
          :value="addressInput"
          type="text"
          placeholder="輸入門牌號碼或路名（例如：博愛路172號...）"
          class="custom-input"
          :disabled="isAddressLocked || isDispatching"
          @input="$emit('update:addressInput',$event.target.value)"
          @keyup.enter="$emit('geocode')"
        />
        <button 
          class="action-btn geocode-btn" 
          @click="$emit('geocode')"
          :disabled="isAddressLocked || isDispatching || !addressInput.trim()"
        >
          定位
        </button>
      </div>
      <span class="input-hint" v-if="!isAddressLocked">
        💡 也可以直接在右側地圖上點擊任一點作為送達目的地
      </span>
      <span class="input-hint locked-text" v-else>
        ⚠️ 配送進行中無法變更地址，但您可繼續挑選店家加點派送！
      </span>
    </div>

    <!-- 步驟 2: 店家類別與下拉選單 -->
    <div class="form-group store-section">
      <label>
        2. 選擇雙北商家
        <span class="store-count-hint">
          ({{ hasCustomerCoord ? `附近推薦 ${stores.length} 家` : `共 ${stores.length} 家` }})
        </span>
      </label>

      <!-- 類別篩選頁籤 -->
      <div class="category-tabs">
        <button 
          class="cat-tab" 
          :class="{ active: selectedCategory === 'ALL' }" 
          @click="$emit('update:category', 'ALL')"
        >
          全部 ({{ totalStoresCount }})
        </button>
        <button 
          class="cat-tab" 
          :class="{ active: selectedCategory === 'FOOD' }" 
          @click="$emit('update:category', 'FOOD')"
        >
          🍽️ 一般餐飲
        </button>
        <button 
          class="cat-tab" 
          :class="{ active: selectedCategory === 'DRINK' }" 
          @click="$emit('update:category', 'DRINK')"
        >
          🧋 手搖飲品
        </button>
      </div>

      <select 
        :value="modelValue" 
        class="custom-select" 
        :disabled="isDispatching" 
        @change="onStoreSelect($event.target.value)"
      >
        <option value="" disabled>請選擇店家 (選中直接開菜單)...</option>
        <option 
          v-for="store in stores" 
          :key="getStoreKey(store)" 
          :value="getStoreKey(store)"
        >
          [{{ getDisplayCategory(store) }}] {{ store.name }} {{ store.distanceKm !== undefined ? `(${store.distanceKm} km)` : '' }}
        </option>
      </select>

      <!-- 購物車摘要卡片 -->
      <div v-if="orderCart && orderCart.totalCount > 0" class="cart-preview-card">
        <div class="cart-header">
          <span class="cart-title">🛒 已選餐點 ({{ orderCart.totalCount }} 件)</span>
          <button class="edit-menu-btn" @click="$emit('reopen-menu')">修改點餐 ✎</button>
        </div>
        <div class="cart-summary-text">
          餐點小計：<strong>NT$ {{ orderCart.itemTotal }}</strong>
        </div>
      </div>
    </div>

    <!-- 步驟 3: 流程狀態提示條（不可點擊） -->
    <div class="dispatch-hint-bar" :class="{ 'ready-mode': hasCustomerCoord && modelValue }">
      <span v-if="!hasCustomerCoord">📍 請先點選地圖或輸入地址設定目的地</span>
      <span v-else-if="!modelValue">🍽️ 請挑選上方店家進行線上點餐</span>
      <span v-else>✅ 店家已選定，點擊菜單即可結帳派單</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  addressInput: {
    type: String,
    default: ''
  },
  stores: {
    type: Array,
    default: () => []
  },
  totalStoresCount: {
    type: Number,
    default: 0
  },
  selectedCategory: {
    type: String,
    default: 'ALL'
  },
  isDispatching: {
    type: Boolean,
    default: false
  },
  isAddressLocked: {
    type: Boolean,
    default: false
  },
  hasCustomerCoord: {
    type: Boolean,
    default: false
  },
  orderCart: {
    type: Object,
    default: null
  },
  getStoreKey: {
    type: Function,
    required: true
  },
  getDisplayCategory: {
    type: Function,
    required: true
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:addressInput',
  'update:category',
  'store-change',
  'geocode',
  'dispatch',
  'open-menu',
  'reopen-menu'
]);

function onStoreSelect(storeId) {
  emit('update:modelValue', storeId);
  emit('store-change');
  // 選完店家直接觸發開菜單彈窗
  emit('open-menu', storeId);
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

.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 6px;
}
.locked-badge {
  color: #f59e0b;
  font-size: 10px;
  margin-left: 6px;
  font-weight: 600;
}
.store-count-hint {
  font-size: 11px;
  color: #38bdf8;
  font-weight: normal;
  margin-left: 4px;
}
.custom-select,
.custom-input {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  box-sizing: border-box;
}
.custom-select:focus,
.custom-input:focus {
  outline: none;
  border-color: #38bdf8;
}
.custom-input:disabled {
  opacity: 0.6;
  background: #182234;
  cursor: not-allowed;
}
.input-with-btn {
  display: flex;
  gap: 6px;
}
.action-btn.geocode-btn {
  background: #334155;
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.action-btn.geocode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.input-hint {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
  display: block;
}
.input-hint.locked-text {
  color: #f59e0b;
}

.category-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  margin-top: 6px;
}
.cat-tab {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.cat-tab.active {
  background: #0284c7;
  color: #ffffff;
  border-color: #38bdf8;
}

.cart-preview-card {
  margin-top: 8px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 8px;
  padding: 8px 10px;
}
.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cart-title {
  font-size: 11px;
  font-weight: 800;
  color: #34d399;
}
.edit-menu-btn {
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.edit-menu-btn:hover {
  text-decoration: underline;
}
.cart-summary-text {
  font-size: 12px;
  color: #f8fafc;
  margin-top: 4px;
}
.cart-summary-text strong {
  color: #10b981;
}

.dispatch-hint-bar {
  width: 100%;
  height: 42px;
  background: #1e293b;
  border: 1px dashed #334155;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #64748b;
  user-select: none;
  cursor: default; /* 純提示，不可點擊 */
  margin-top: 10px;
  transition: all 0.2s ease;
}

.dispatch-hint-bar.ready-mode {
  background: rgba(14, 165, 233, 0.08);
  border-color: #0284c7;
  color: #38bdf8;
  font-weight: 600;
}
</style>