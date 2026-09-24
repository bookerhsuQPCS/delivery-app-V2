<!-- File: client/src/components/dispatch/DispatchForm.vue -->
<template>
  <div class="control-card dispatch-box">
    <div class="card-title">📦 建立模擬派送單</div>

    <!-- 步驟 1: 外送地址放上面 -->
    <div class="form-group">
      <label>1. 外送地址 (門牌 / 地標)</label>
      <div class="input-with-btn">
        <input
          :value="addressInput"
          type="text"
          placeholder="輸入門牌號碼或路名（例如：博愛路172號...）"
          class="custom-input"
          :disabled="isDispatching"
          @input="$emit('update:addressInput',$event.target.value)"
          @keyup.enter="$emit('geocode')"
        />
        <button 
          class="action-btn geocode-btn" 
          @click="$emit('geocode')"
          :disabled="isDispatching || !addressInput.trim()"
        >
          定位
        </button>
      </div>
      <span class="input-hint">💡 也可以直接在右側地圖上點擊任一點作為送達目的地</span>
    </div>

    <!-- 步驟 2: 店家類別與下拉選單放下面 -->
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
        @change="$emit('update:modelValue', $event.target.value);$emit('store-change')"
      >
        <option value="" disabled>請選擇店家...</option>
        <option 
          v-for="store in stores" 
          :key="getStoreKey(store)" 
          :value="getStoreKey(store)"
        >
          [{{ getDisplayCategory(store) }}] {{ store.name }} {{ store.distanceKm !== undefined ? `(${store.distanceKm} km)` : '' }}
        </option>
      </select>
    </div>

    <div class="dispatch-action-row">
      <button
        class="primary-dispatch-btn"
        :disabled="isDispatching || !modelValue || !hasCustomerCoord"
        @click="$emit('dispatch')"
      >
        <span v-if="!isDispatching">🚀 立即指派配送</span>
        <span v-else>路網運算指派中...</span>
      </button>
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
  hasCustomerCoord: {
    type: Boolean,
    default: false
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

defineEmits([
  'update:modelValue',
  'update:addressInput',
  'update:category',
  'store-change',
  'geocode',
  'dispatch'
]);
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
.input-hint {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
  display: block;
}

.primary-dispatch-btn {
  width: 100%;
  background: linear-gradient(135deg, #0284c7, #2563eb);
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-dispatch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary-dispatch-btn:not(:disabled) {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}
.primary-dispatch-btn:not(:disabled):hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}
</style>