// File: client/src/composables/useOrderDispatch.js
import { ref, onMounted, onUnmounted } from 'vue';
import { getApiBase, fetchOsrmRoute } from '@/utils/geoUtils';

const DISPATCH_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0284c7'];

export function useOrderDispatch() {
  const registeredRiders = ref([]);
  const orders = ref([]);
  const isDispatching = ref(false);

  let broadcastChannel = null;
  const localTimers = new Map();

  async function loadRiders() {
    try {
      const res = await fetch(`${getApiBase()}/api/riders`);
      if (res.ok) {
        registeredRiders.value = await res.json();
      }
    } catch (err) {
      console.error('[loadRiders] 載入外送員失敗:', err);
    }
  }

  function pickBestRider() {
    if (!registeredRiders.value || registeredRiders.value.length === 0) {
      return { name: '外送騎士', avatar: '🛵', vehicle: '機車' };
    }
    const busyRiderNames = new Set(
      orders.value.filter((o) => o.status !== '已送達').map((o) => o.rider?.name)
    );
    const idleRiders = registeredRiders.value.filter((r) => !busyRiderNames.has(r.name));
    const pool = idleRiders.length > 0 ? idleRiders : registeredRiders.value;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function broadcastLocation(orderId, lat, lng, stage, status) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'ORDER_LOCATION_UPDATE',
          orderId,
          lat: Number(lat),
          lng: Number(lng),
          stage: String(stage),
          status: String(status)
        });
      } catch (e) {}
    }
  }

  function broadcastNewOrder(order) {
    if (broadcastChannel) {
      try {
        const payload = JSON.parse(
          JSON.stringify({
            type: 'ORDER_DISPATCHED',
            order: {
              orderId: order.orderId,
              color: order.color,
              rider: {
                name: order.rider.name,
                avatar: order.rider.avatar,
                vehicle: order.rider.vehicle
              },
              riderOrigin: order.riderOrigin,
              restaurant: order.restaurant,
              customer: order.customer,
              routeCoords: [...order.pickupRouteCoords, ...order.deliverRouteCoords]
            }
          })
        );
        broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }

  async function createAndDispatchOrder({
    store,
    storeCoord,
    customerCoord,
    customerAddress,
    onOrderCreated,
    onRiderStep
  }) {
    isDispatching.value = true;
    const orderId = `ORD-${Date.now().toString().slice(-5)}`;
    const assignedRider = pickBestRider();

    const riderOrigin = [
      storeCoord[0] + (Math.random() - 0.5) * 0.012,
      storeCoord[1] + (Math.random() - 0.5) * 0.012
    ];

    try {
      const [pickupRoute, deliverRoute] = await Promise.all([
        fetchOsrmRoute(riderOrigin, storeCoord),
        fetchOsrmRoute(storeCoord, customerCoord)
      ]);

      const deliverDistKm = (deliverRoute.distance / 1000).toFixed(1);
      const surcharge = deliverRoute.distance > 3000 ? 30 : 0;
      const deliveryFee = 49 + surcharge;
      const color = DISPATCH_COLORS[orders.value.length % DISPATCH_COLORS.length];

      const newOrder = {
        orderId,
        color,
        rider: assignedRider,
        riderOrigin,
        storeName: store.name,
        storeCategory: store.category || '餐飲美食',
        restaurant: storeCoord,
        customer: customerCoord,
        address: customerAddress || '指定外送點',
        deliveryFee,
        surcharge,
        deliverDistKm,
        pickupRouteCoords: pickupRoute.coords || [riderOrigin, storeCoord],
        deliverRouteCoords: deliverRoute.coords || [storeCoord, customerCoord],
        holdSeconds: 3,
        stage: 'ASSIGNED_HOLD',
        status: `已接單 (確認中 3秒)`,
        eta: Math.ceil(((pickupRoute.coords?.length || 10) + (deliverRoute.coords?.length || 10)) * 0.25)
      };

      orders.value.unshift(newOrder);
      broadcastNewOrder(newOrder);

      if (onOrderCreated) {
        onOrderCreated(newOrder);
      }

      startSimulation(newOrder, onRiderStep);
    } catch (err) {
      console.error('[createAndDispatchOrder] 派發失敗:', err);
    } finally {
      isDispatching.value = false;
    }
  }

  // 兩階段動態模擬
  function startSimulation(ord, onRiderStep) {
    const pCoords = ord.pickupRouteCoords;
    const dCoords = ord.deliverRouteCoords;
    let pIdx = 0;
    let dIdx = 0;
    // 當前階段行駛過之座標
    let traveledPoints = [ord.riderOrigin];

    function updateOrderState(stage, status) {
      ord.stage = stage;
      ord.status = status;
      const targetIdx = orders.value.findIndex((o) => o.orderId === ord.orderId);
      if (targetIdx !== -1) {
        orders.value[targetIdx] = { ...ord };
      }
    }

    const timer = setInterval(() => {
      // 階段 0：3 秒確認期
      if (ord.stage === 'ASSIGNED_HOLD') {
        ord.holdSeconds--;
        if (ord.holdSeconds > 0) {
          updateOrderState('ASSIGNED_HOLD', `已接單 (確認中 ${ord.holdSeconds}秒)`);
        } else {
          updateOrderState('PICKING_UP', '前往取餐中');
        }
        broadcastLocation(ord.orderId, ord.riderOrigin[0], ord.riderOrigin[1], ord.stage, ord.status);
        return;
      }

      // 階段 1：前往取餐中
      if (ord.stage === 'PICKING_UP') {
        if (pIdx < pCoords.length) {
          const cur = pCoords[pIdx];
          traveledPoints.push(cur);
          if (onRiderStep) onRiderStep(ord.orderId, cur, traveledPoints, false, false);
          broadcastLocation(ord.orderId, cur[0], cur[1], ord.stage, ord.status);
          pIdx += 2;
        } else {
          // 🌟 取餐完成！切換為外送途中，重置 traveledPoints 為店家座標
          updateOrderState('DELIVERING', '外送途中 (往客戶端)');
          traveledPoints = [ord.restaurant];
          // 第5個參數 isPickedUp = true：通知地圖清除取餐舊路徑與起點標記
          if (onRiderStep) onRiderStep(ord.orderId, ord.restaurant, traveledPoints, false, true);
        }
      }
      // 階段 2：送往客戶端途中
      else if (ord.stage === 'DELIVERING') {
        if (dIdx < dCoords.length) {
          const cur = dCoords[dIdx];
          traveledPoints.push(cur);
          if (onRiderStep) onRiderStep(ord.orderId, cur, traveledPoints, false, false);
          broadcastLocation(ord.orderId, cur[0], cur[1], ord.stage, ord.status);
          dIdx += 2;
        } else {
          // 送達完成
          updateOrderState('DELIVERED', '已送達');
          ord.eta = 0;
          const lastPt = dCoords[dCoords.length - 1];
          // isDelivered = true
          if (onRiderStep) onRiderStep(ord.orderId, lastPt, traveledPoints, true, false);
          broadcastLocation(ord.orderId, lastPt[0], lastPt[1], ord.stage, ord.status);

          fetch(`${getApiBase()}/api/orders/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: ord.orderId,
              riderName: ord.rider?.name,
              storeName: ord.storeName,
              storeCategory: ord.storeCategory,
              customerAddress: ord.address,
              deliveryFee: ord.deliveryFee,
              surcharge: ord.surcharge,
              deliverDistKm: ord.deliverDistKm,
              completedAt: new Date().toISOString(),
              storeCoord: ord.restaurant,
              customerCoord: ord.customer,
              deliverRouteCoords: ord.deliverRouteCoords
            })
          }).catch((err) => console.error('[Order Complete] 儲存失敗:', err));

          clearInterval(timer);
          localTimers.delete(ord.orderId);
        }
      }
    }, 1000);

    localTimers.set(ord.orderId, timer);
  }

  onMounted(() => {
    try {
      broadcastChannel = new BroadcastChannel('delivery_dispatch_channel');
    } catch (e) {}
  });

  onUnmounted(() => {
    if (broadcastChannel) broadcastChannel.close();
    localTimers.forEach((t) => clearInterval(t));
    localTimers.clear();
  });

  return {
    registeredRiders,
    orders,
    isDispatching,
    loadRiders,
    createAndDispatchOrder
  };
}