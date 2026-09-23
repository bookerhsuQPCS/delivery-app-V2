<!-- File: client/src/components/admin/StandbyPanel.vue -->
<template>
  <aside class="right-standby-panel">
    <div class="right-panel-header">
      <div class="header-left">
        <span class="panel-icon">🛵</span>
        <span class="panel-title">待接單外送員 (店家周遭)</span>
      </div>
      <span class="time-scope-pill" v-if="currentStore">{{ currentStore.name.slice(0, 6) }}</span>
    </div>

    <!-- 商家備餐與出發時程卡 -->
    <div class="dispatch-timeline-card" v-if="activeDispatchOrder">
      <div class="timeline-title-row">
        <span class="tl-store">🏪 {{ activeDispatchOrder.storeName }}</span>
        <span class="tl-stage-badge" :class="activeDispatchOrder.stage">
          {{ activeDispatchOrder.status }}
        </span>
      </div>

      <div class="timeline-progress-section">
        <div class="progress-label-row">
          <span class="prog-title">🍳 商家備餐進度</span>
          <span class="timer-countdown" v-if="activeDispatchOrder.prepRemainingMin > 0">
            剩餘 <b>{{ activeDispatchOrder.prepRemainingMin }}</b> 分 (共 {{ activeDispatchOrder.prepTotalMin }} 分)
          </span>
          <span class="timer-ready" v-else>✅ 備餐完畢！</span>
        </div>
        <div class="progress-track">
          <div 
            class="progress-fill" 
            :style="{ width: `${Math.min(100, Math.round(((activeDispatchOrder.prepTotalMin - activeDispatchOrder.prepRemainingMin) / activeDispatchOrder.prepTotalMin) * 100))}%` }"
          ></div>
        </div>
      </div>

      <div class="rider-schedule-box">
        <div class="schedule-line">
          <span class="sched-icon">🛵</span>
          <span class="sched-text">
            騎士：<b>{{ activeDispatchOrder.rider.name }}</b>
            (備餐第 <b>{{ activeDispatchOrder.departAtMin }}</b> 分出發)
          </span>
        </div>
        <div class="schedule-state-hint" :class="activeDispatchOrder.stage">
          {{ getRiderStageDescription(activeDispatchOrder) }}
        </div>
      </div>

      <div class="sim-speed-controls" v-if="activeDispatchOrder.prepRemainingMin > 0">
        <button class="btn-fast" @click="fastForwardMealReady(activeDispatchOrder)">
          ⚡ 立即備餐完畢 (測試)
        </button>
      </div>
    </div>

    <!-- 候選外送員名單 -->
    <div class="candidates-scroll-list">
      <div v-if="candidateRiders.length === 0" class="empty-candidate-hint">
        <div class="empty-icon">🏪</div>
        <div class="empty-text">請先選擇取餐店家</div>
        <div class="empty-sub">系統將自動於店家周遭 0.1 ~ 2km 呼叫就近待命外送員</div>
      </div>
      <div 
        v-else
        v-for="c in candidateRiders" 
        :key="c.name" 
        class="candidate-card"
        :class="{ selected: assignedCandidateName === c.name, unselected: assignedCandidateName && assignedCandidateName !== c.name }"
      >
        <div class="c-avatar-box">{{ c.avatar }}</div>
        <div class="c-detail">
          <div class="c-top">
            <span class="c-name">{{ c.name }}</span>
            <span class="c-rating">★ {{ c.rating }}</span>
          </div>
          <div class="c-mid">
            <span class="c-vehicle">{{ c.vehicle }}</span>
            <span class="c-time-tag">⏱️ 距店 {{ c.travelMinutes }} 分鐘 ({{ c.distToStoreKm }} km)</span>
          </div>
        </div>
        <div class="c-badge-status">
          <span class="tag-chosen" v-if="assignedCandidateName === c.name">🎯 出勤中</span>
          <span class="tag-standby" v-else-if="!assignedCandidateName">待命接單</span>
          <span class="tag-dropped" v-else>未選中</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  currentStore: Object,
  candidateRiders: Array,
  assignedCandidateName: String,
  activeDispatchOrder: Object
});

function getRiderStageDescription(order) {
  if (!order) return '';
  if (order.status === '已送達') return '🎉 餐點已全數送達客戶手中！';
  if (order.stage === 'STANDBY') {
    const waitMin = Math.max(0, order.departAtMin - order.elapsedSimMin);
    return `⏳ 外送員正在出發點待命中，預計第 ${order.departAtMin} 分 (${waitMin} 分後) 啟程前往商家。`;
  }
  if (order.stage === 'PICKING_UP') return '🛵 外送員已出發！全速前往商家取餐中...';
  if (order.stage === 'WAITING_MEAL') return `🍳 外送員已抵達商家！正在等候備餐完成 (剩餘 ${order.prepRemainingMin} 分鐘)。`;
  if (order.stage === 'DELIVERING') return '🍱 取餐完成！正在全速前往外送地址。';
  return order.status;
}

function fastForwardMealReady(order) {
  if (order) order.prepRemainingMin = 0;
}
</script>

<style scoped>
.right-standby-panel { position: absolute; top: 105px; right: 14px; bottom: 275px; width: 320px; z-index: 1000; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px); border-radius: 18px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); border: 1px solid rgba(0, 0, 0, 0.08); display: flex; flex-direction: column; overflow: hidden; }
.right-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; border-bottom: 1px solid #f1f5f9; background: #fafafa; }
.header-left { display: flex; align-items: center; gap: 6px; }
.panel-icon { font-size: 16px; }
.panel-title { font-size: 13px; font-weight: 800; color: #0f172a; }
.time-scope-pill { font-size: 10px; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 10px; }
.dispatch-timeline-card { margin: 10px 12px 6px; padding: 10px 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px; }
.timeline-title-row { display: flex; align-items: center; justify-content: space-between; }
.tl-store { font-size: 12px; font-weight: 800; color: #1e293b; }
.tl-stage-badge { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: #e2e8f0; color: #475569; }
.tl-stage-badge.STANDBY { background: #fef3c7; color: #b45309; }
.tl-stage-badge.PICKING_UP { background: #e0f2fe; color: #0369a1; }
.tl-stage-badge.WAITING_MEAL { background: #ffedd5; color: #c2410c; }
.tl-stage-badge.DELIVERING { background: #dcfce7; color: #15803d; }
.tl-stage-badge.DELIVERED { background: #f1f5f9; color: #64748b; }
.timeline-progress-section { display: flex; flex-direction: column; gap: 4px; }
.progress-label-row { display: flex; justify-content: space-between; font-size: 10px; }
.prog-title { color: #64748b; font-weight: 700; }
.timer-countdown b { color: #ea580c; }
.timer-ready { color: #16a34a; font-weight: 800; }
.progress-track { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #f97316, #10b981); transition: width 0.4s ease; }
.rider-schedule-box { background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #edf2f7; display: flex; flex-direction: column; gap: 4px; }
.schedule-line { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.schedule-state-hint { font-size: 10px; color: #64748b; }
.sim-speed-controls { display: flex; justify-content: flex-end; }
.btn-fast { background: #fff7ed; border: 1px solid #ffedd5; color: #ea580c; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; cursor: pointer; }
.candidates-scroll-list { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
.empty-candidate-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 10px; text-align: center; color: #94a3b8; }
.empty-icon { font-size: 28px; margin-bottom: 6px; }
.empty-text { font-size: 12px; font-weight: 800; color: #475569; }
.empty-sub { font-size: 10px; margin-top: 4px; color: #94a3b8; }
.candidate-card { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: #ffffff; border: 1px solid #e2e8f0; }
.candidate-card.selected { background: #f0fdf4; border-color: #86efac; }
.candidate-card.unselected { opacity: 0.6; }
.c-avatar-box { font-size: 18px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 8px; }
.c-detail { flex: 1; display: flex; flex-direction: column; }
.c-top { display: flex; align-items: center; gap: 6px; }
.c-name { font-size: 12px; font-weight: 800; color: #0f172a; }
.c-rating { font-size: 10px; font-weight: 700; color: #f59e0b; }
.c-mid { display: flex; align-items: center; gap: 6px; }
.c-vehicle { font-size: 10px; color: #64748b; }
.c-time-tag { font-size: 10px; font-weight: 700; color: #0284c7; }
.tag-chosen { color: #15803d; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; }
.tag-standby { color: #0369a1; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; }
.tag-dropped { color: #94a3b8; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-size: 8px; }
</style>