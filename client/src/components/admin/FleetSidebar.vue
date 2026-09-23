<!-- File: client/src/components/admin/FleetSidebar.vue -->
<template>
  <aside class="left-rider-sidebar">
    <div class="sidebar-header">
      <span class="header-icon">🛵</span>
      <span class="header-title">外送車隊列表</span>
    </div>

    <div class="rider-menu-list">
      <button 
        class="rider-menu-item" 
        :class="{ active: selectedRiderName === null }"
        @click="$emit('select-rider', null)"
      >
        <div class="item-avatar all-avatar">🌐</div>
        <div class="item-meta">
          <span class="item-name">全部車輛</span>
          <span class="item-badge">{{ totalOrdersCount }} 單</span>
        </div>
      </button>

      <button 
        v-for="rider in activeRiders" 
        :key="rider.name" 
        class="rider-menu-item"
        :class="{ active: selectedRiderName === rider.name }"
        @click="$emit('select-rider', rider.name)"
      >
        <div class="item-avatar">{{ rider.avatar }}</div>
        <div class="item-meta">
          <div class="name-row">
            <span class="item-name">{{ rider.name }}</span>
            <span class="item-rating">★ {{ rider.rating }}</span>
          </div>
          <div class="sub-row">
            <span class="item-plate">{{ rider.vehicle }}</span>
            <span class="item-badge active-tag">{{ rider.count }} 單</span>
          </div>
        </div>
      </button>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  activeRiders: Array,
  selectedRiderName: String,
  totalOrdersCount: Number
});

defineEmits(['select-rider']);
</script>

<style scoped>
.left-rider-sidebar { position: absolute; top: 14px; left: 14px; bottom: 275px; width: 185px; z-index: 1000; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px); border-radius: 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; }
.sidebar-header { display: flex; align-items: center; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; }
.header-icon { font-size: 16px; }
.header-title { font-size: 13px; font-weight: 800; color: #0f172a; }
.rider-menu-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.rider-menu-item { border: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; transition: all 0.2s ease; }
.rider-menu-item.active { background: #007AFF; border-color: #007AFF; }
.rider-menu-item.active * { color: #ffffff !important; }
.item-avatar { font-size: 18px; width: 30px; height: 30px; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.all-avatar { background: #e0f2fe; }
.item-meta { flex: 1; }
.name-row { display: flex; justify-content: space-between; align-items: center; }
.item-name { font-size: 12px; font-weight: 700; color: #1e293b; }
.item-rating { font-size: 10px; font-weight: 700; color: #eab308; }
.sub-row { display: flex; justify-content: space-between; align-items: center; }
.item-plate { font-size: 9px; color: #64748b; }
.item-badge { font-size: 10px; background: #e2e8f0; color: #475569; padding: 1px 5px; border-radius: 10px; font-weight: 700; }
.active-tag { background: #dcfce7; color: #15803d; }
</style>