// File: client/src/utils/navigationUtils.js
import { calculateBearing } from './geoUtils';

// 根據雙段路況座標，計算即時 Turn-by-Turn 轉向指引（純函式，不做任何 DOM/reactive 操作）
export function calculateTurnGuidance(coords, currentStep, isPickupPhase) {
  if (!coords || currentStep >= coords.length - 1) {
    return isPickupPhase
      ? { symbol: '🏪', instruction: '已抵達商家門市，準備取餐', type: 'arrived' }
      : { symbol: '🏁', instruction: '已抵達客戶送餐目的地', type: 'arrived' };
  }

  if (currentStep >= coords.length - 3) {
    return {
      symbol: isPickupPhase ? '🏪' : '🎯',
      instruction: isPickupPhase ? '前方即將抵達取餐商家' : '前方即將抵達客戶目的地',
      type: 'arrived'
    };
  }

  const p1 = coords[currentStep];
  const p2 = coords[currentStep + 1];
  const p3 = coords[Math.min(currentStep + 2, coords.length - 1)];

  const currentBearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
  const nextBearing = calculateBearing(p2[0], p2[1], p3[0], p3[1]);

  let diff = nextBearing - currentBearing;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;

  const targetName = isPickupPhase ? '商家門市' : '客戶地址';

  if (diff > 25 && diff <= 65) {
    return { symbol: '↗', instruction: `前方靠右行駛往 ${targetName}`, type: 'slight-right' };
  }
  if (diff > 65 && diff <= 125) {
    return { symbol: '➡', instruction: `下個路口右轉往 ${targetName}`, type: 'turn-right' };
  }
  if (diff < -25 && diff >= -65) {
    return { symbol: '↖', instruction: `前方靠左行駛往 ${targetName}`, type: 'slight-left' };
  }
  if (diff < -65 && diff >= -125) {
    return { symbol: '⬅', instruction: `下個路口左轉往 ${targetName}`, type: 'turn-left' };
  }
  if (Math.abs(diff) > 125) {
    return { symbol: '🔄', instruction: '前方請適時迴轉', type: 'uturn' };
  }
  return { symbol: '⬆', instruction: `沿當前道路直行前往 ${targetName}`, type: 'straight' };
}

// 雙段任務階段 pill 樣式 class
export function getStagePillClass(stage) {
  if (stage === 'STANDBY') return 'stage-standby';
  if (stage === 'PICKING_UP') return 'stage-pickup';
  if (stage === 'WAITING_MEAL') return 'stage-waiting';
  if (stage === 'DELIVERING') return 'stage-deliver';
  if (stage === 'DELIVERED') return 'stage-delivered';
  return 'stage-pickup';
}

// 雙段任務階段 pill 文字
export function getStagePillText(order) {
  if (!order) return '';
  if (order.status === '已送達' || order.stage === 'DELIVERED') return '🎉 訂單已圓滿送達';
  if (order.stage === 'STANDBY') {
    const remain = Math.max(0, (order.departAtMin || 0) - (order.elapsedSimMin || 0));
    return `⏳ 等候出發：預計第 ${order.departAtMin || 0} 分啟程 (${remain}分後)`;
  }
  if (order.stage === 'PICKING_UP') return '📍 階段 1/2：前往商家取餐';
  if (order.stage === 'WAITING_MEAL') return `🍳 現場等候備餐中 (剩餘 ${order.prepRemainingMin || 0} 分鐘)`;
  if (order.stage === 'DELIVERING') return '🚀 階段 2/2：配送送達客戶';
  return order.status;
}

// 訂單清單卡片狀態 badge class
export function getOrderBadgeClass(status) {
  if (status === '已送達') return 'done';
  if (status === '前往取餐中') return 'pickup';
  return 'delivering';
}
