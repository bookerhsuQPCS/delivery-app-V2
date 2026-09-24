// File: src/composables/useRestaurantFilter.js
import { ref, computed } from 'vue';
import { getApiBase } from '@/utils/geoUtils';

export function useRestaurantFilter() {
  const restaurants = ref([]);
  const selectedCategoryFilter = ref('ALL');
  const selectedStoreId = ref('');
  const targetCustomerCoord = ref(null);

  // 取得店家唯一 Key
  function getStoreKey(store) {
    if (!store) return '';
    return String(store.storeId || store.id || store.name || '');
  }

  // 取得合法 [lat, lng] 座標
  function getValidCoord(store) {
    if (!store) return [25.0478, 121.5170];
    if (Array.isArray(store.coords) && store.coords.length >= 2) {
      return [Number(store.coords[0]), Number(store.coords[1])];
    }
    if (store.lat && store.lng) {
      return [Number(store.lat), Number(store.lng)];
    }
    if (Array.isArray(store.restaurant)) {
      return [Number(store.restaurant[0]), Number(store.restaurant[1])];
    }
    return [25.0478, 121.5170];
  }

  // 計算兩點球面直線距離 (公里)
  function getDistanceKm(coord1, coord2) {
    if (!coord1 || !coord2) return 999;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coord2[0] - coord1[0]);
    const dLng = toRad(coord2[1] - coord1[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coord1[0])) * Math.cos(toRad(coord2[0])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  // 判斷是否為手搖飲品
  function isDrinkType(store) {
    const cat = String(store.category || '');
    if (cat.includes('手搖') || cat.includes('飲品')) return true;
    if (cat.includes('餐飲') || cat.includes('美食')) return false;
    const name = String(store.name || '');
    return /茶|手搖|咖啡|冷飲|清心|五十嵐|麻古|迷客夏|可不可|茶坊/i.test(name);
  }

  // 取得顯示分類文字
  function getDisplayCategory(store) {
    return isDrinkType(store) ? '手搖飲品' : '餐飲美食';
  }

  // 根據類別與外送地址排序篩選
  const filteredRestaurants = computed(() => {
    let list = restaurants.value;

    if (selectedCategoryFilter.value === 'DRINK') {
      list = list.filter((s) => isDrinkType(s));
    } else if (selectedCategoryFilter.value === 'FOOD') {
      list = list.filter((s) => !isDrinkType(s));
    }

    if (!targetCustomerCoord.value) {
      return list;
    }

    const listWithDist = list.map((s) => {
      const sCoord = getValidCoord(s);
      return {
        ...s,
        distanceKm: getDistanceKm(sCoord, targetCustomerCoord.value)
      };
    });

    listWithDist.sort((a, b) => a.distanceKm - b.distanceKm);
    const nearby = listWithDist.filter((s) => s.distanceKm <= 5);
    return nearby.length >= 5 ? nearby : listWithDist.slice(0, 30);
  });

  // 載入店家列表 API
  async function loadRestaurants() {
    try {
      const res = await fetch(`${getApiBase()}/api/restaurants`);
      if (res.ok) {
        restaurants.value = await res.json();
      }
    } catch (err) {
      console.error('[loadRestaurants] 載入店家失敗:', err);
    }
  }

  // 切換類別分頁並自動選中該類第一筆
  function setCategory(cat, onSelectStore) {
    selectedCategoryFilter.value = cat;
    setTimeout(() => {
      if (filteredRestaurants.value.length > 0) {
        const first = filteredRestaurants.value[0];
        selectedStoreId.value = getStoreKey(first);
        if (onSelectStore) onSelectStore(first);
      } else {
        selectedStoreId.value = '';
      }
    }, 40);
  }

  return {
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
  };
}