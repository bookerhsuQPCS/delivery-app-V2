<!-- File: client/src/components/admin/RoutePlanningCard.vue -->
<template>
  <div class="route-planning-card">
    <!-- 步驟 1: 輸入外送地址 -->
    <div class="card-section address-section">
      <div class="section-badge customer-badge">🏠 1. 外送目的地 (輸入或點擊地圖)</div>
      <div class="address-input-bar">
        <input 
          type="text" 
          v-model="inputAddressText" 
          class="address-search-input"
          placeholder="請輸入雙北地址 (例：台北市中正區忠孝西路一段66號)"
          @keyup.enter="triggerSearch"
        />
        <button class="btn-geo-search" @click="triggerSearch" :disabled="isSearchingAddress">
          {{ isSearchingAddress ? '...' : '🔍 定位' }}
        </button>
      </div>
      <div class="section-sub current-addr-text">
        {{ customerCoords ? `📍 ${currentAddress}` : '👈 請輸入地址定位或直接點擊地圖' }}
      </div>
    </div>

    <div class="divider-arrow">➔</div>

    <!-- 步驟 2: 商家過濾與選擇 -->
    <div class="card-section store-section">
      <div class="store-top-row">
        <div class="section-badge store-badge">🏪 2. 取餐商家 (必選)</div>
        <div class="category-tabs">
          <button 
            type="button" 
            class="cat-tab" 
            :class="{ active: currentCategory === 'ALL' }" 
            @click="setCategory('ALL')"
          >
            全部 ({{ availableStores.length }})
          </button>
          <button 
            type="button" 
            class="cat-tab tab-drink" 
            :class="{ active: currentCategory === 'DRINK' }" 
            @click="setCategory('DRINK')"
          >
            🧋 飲料
          </button>
          <button 
            type="button" 
            class="cat-tab" 
            :class="{ active: currentCategory === 'FOOD' }" 
            @click="setCategory('FOOD')"
          >
            🍱 一般
          </button>
        </div>
      </div>

      <select 
        class="store-select-dropdown" 
        :value="currentStore ? `${currentStore.name}__${currentStore.address}` : ''" 
        @change="$emit('store-change',$event.target.value)"
        :disabled="!customerCoords"
      >
        <option value="" disabled selected>
          {{ customerCoords ? '-- 📍 請選擇取餐店家 (必選) --' : '-- ⚠️ 請先設定外送地址 --' }}
        </option>

        <optgroup label="🟢 5公里內商家 (標準外送費 49元)" v-if="filteredGroupedStores.standard.length > 0">
          <option 
            v-for="s in filteredGroupedStores.standard" 
            :key="`${s.name}__${s.address}`" 
            :value="`${s.name}__${s.address}`"
          >
            {{ isDrinkStore(s) ? '🧋' : '🍱' }} {{ s.name }} ({{ s.distKm }}km · [{{ getCityLabel(s) }}] {{ s.district }})
          </option>
        </optgroup>

        <optgroup label="🟠 5~10公里商家 (稍遠加價 +30元 = 79元)" v-if="filteredGroupedStores.far.length > 0">
          <option 
            v-for="s in filteredGroupedStores.far" 
            :key="`${s.name}__${s.address}`" 
            :value="`${s.name}__${s.address}`"
          >
            {{ isDrinkStore(s) ? '🧋' : '🍱' }} [稍遠] {{ s.name }} ({{ s.distKm }}km · [{{ getCityLabel(s) }}] {{ s.district }})
          </option>
        </optgroup>
      </select>

      <div v-if="currentStore && isFarStore" class="far-alert-banner">
        🛵 <b>稍遠外送提醒</b>：距離 {{ currentStoreDistanceKm }}km，需加收 <b>30元</b> (運費 49 + 30 = <b>79元</b>)
      </div>
      <div v-else-if="currentStore && !isFarStore" class="standard-fee-tag">
        ✅ 5公里標準配送：外送費 <b>49元</b> (距外送點 {{ currentStoreDistanceKm }}km)
      </div>
      <div v-else class="section-sub store-hint">
        {{ customerCoords ? `已為您列出 10km 內 ${availableStores.length} 間可送店家` : '設定外送地址後自動載入周圍 10km 店家' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { isDrinkStore, getCityLabel } from '@/utils/geoUtils';

const props = defineProps({
  customerCoords: Array,
  currentAddress: String,
  currentStore: Object,
  availableStores: Array,
  filteredGroupedStores: Object,
  isFarStore: Boolean,
  currentStoreDistanceKm: Number,
  isSearchingAddress: Boolean,
  currentCategory: {
    type: String,
    default: 'ALL'
  }
});

const emit = defineEmits(['address-search', 'store-change', 'update:category']);

const inputAddressText = ref('');

function setCategory(cat) {
  emit('update:category', cat);
}

watch(() => props.currentAddress, (newVal) => {
  if (newVal && newVal !== '尚未設定') {
    inputAddressText.value = newVal;
  }
});

function triggerSearch() {
  if (inputAddressText.value.trim()) {
    emit('address-search', inputAddressText.value.trim());
  }
}
</script>

<style scoped>
.route-planning-card {
  position: absolute;
  top: 14px;
  left: 215px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  padding: 10px 14px;
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.card-section { display: flex; flex-direction: column; }
.address-section { width: 260px; }
.store-section { width: 330px; }
.section-badge { font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; display: inline-block; width: fit-content; margin-bottom: 4px; }
.customer-badge { background: #fef3c7; color: #d97706; }
.store-badge { background: #e0f2fe; color: #0284c7; }
.address-input-bar { display: flex; gap: 4px; margin-bottom: 4px; }
.address-search-input { flex: 1; font-size: 11px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.address-search-input:focus { border-color: #0284c7; }
.btn-geo-search { border: none; background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 800; padding: 0 8px; border-radius: 6px; cursor: pointer; }
.current-addr-text { font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.store-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.category-tabs { display: flex; gap: 3px; }
.cat-tab { border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; cursor: pointer; }
.cat-tab.active { background: #0284c7; color: #ffffff; border-color: #0284c7; }
.cat-tab.tab-drink.active { background: #059669; border-color: #059669; }
.store-select-dropdown { font-size: 11px; font-weight: 800; color: #0f172a; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; outline: none; cursor: pointer; width: 100%; }
.far-alert-banner { font-size: 10px; color: #ea580c; background: #fff7ed; border: 1px solid #ffedd5; padding: 3px 6px; border-radius: 4px; margin-top: 4px; line-height: 1.2; }
.standard-fee-tag { font-size: 10px; color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 3px 6px; border-radius: 4px; margin-top: 4px; }
.store-hint { font-size: 9px; color: #94a3b8; margin-top: 3px; }
.divider-arrow { font-size: 16px; font-weight: 900; color: #cbd5e1; margin-top: 22px; }
</style>