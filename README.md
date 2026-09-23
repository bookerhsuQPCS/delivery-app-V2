# 🛵 Real-Time Delivery Tracking & Dispatch System (外送調度與駕駛模擬系統)

基於 **Node.js (Express + WebSocket)** 與 **Vue 3 + Leaflet** 的即時外送調度與駕駛導航系統。支援多網頁多端連動、動態 OSRM 路徑規劃、多外送員即時 GPS 座標推播，以及專為手機端設計的 Turn-by-Turn 轉向模擬導航。

---

## 🌟 核心功能與架構

### 1. 🏢 調度指揮中心 (`/admin`)
* **點擊地圖指定送餐地址**：點擊 Leaflet 地圖任意位置，即時透過 OpenStreetMap Nominatim 逆地理編碼反查詳細門牌地址。
* **智慧派單**：向後端請求隨機店家至指定送餐點的 5km 內可用真實路徑（OSRM），隨機指派在線外送員出車。
* **全局追蹤與批次管理**：多單多色軌跡管理、即時剩餘時間（ETA）與距離計算，支援一鍵清除已送達訂單。
* **外送員快速篩選**：左側側欄即時統計各外送員接單數，可一鍵過濾特定外送員的行車軌跡。

### 2. 📱 手機外送員專屬版面 (`/mobile`)
* **單一外送員視角隔離**：嚴格過濾其他外送員路線，地圖僅顯示個人負責的取送餐點位與路徑。
* **Turn-by-Turn 車載模擬導航**：
  * 動態計算路段航向夾角差（Turn Angle），即時呈現 **⬆ 直行 / ⬅ 左轉 / ➡ 右轉 / 🔄 迴轉 / 🏁 抵達**。
  * 機車圖示隨行車角度（Bearing）即時旋轉車頭方向。
  * 已行駛軌跡自動轉為暗灰，未行駛路段保持高亮指引。
* **鏡頭鎖定追隨（Auto-Follow）**：平滑鎖定機車置中視角，支援自由平移與一鍵全覽切換。
* **點擊式身分切換面板**：支援抽屜式彈出名單，快速切換不同外送員身分。

### 3. ⚡ 後端廣播中心 (`server`)
* **WebSocket 全局推播**：新連線自動同步歷史訂單（`INIT_ORDERS`），派單與 GPS 更新（每秒推播）即時廣播至所有開啟的客戶端視窗。
* **OSRM 路網運算**：自動生成符合真實道路拓撲的經緯度陣列與方位角。

---

## 🛠️ 技術棧 (Tech Stack)

* **前端 (Client)**：Vue 3、Vue Router 4、Leaflet、CSS3 (Glassmorphism & Mobile HUD)
* **後端 (Server)**：Node.js、Express、WebSocket (`ws`)、Axios
* **路網與圖資**：OpenStreetMap (OSM) TileLayer、OSRM Routing API、Nominatim Geocoding API

---

## 📁 專案目錄結構

```text
delivery-app/
├── client/                     # 前端 Vue 3 應用
│   ├── src/
│   │   ├── views/
│   │   │   ├── AdminView.vue        # 調度指揮中心 (/admin)
│   │   │   ├── DriverView.vue       # 桌機外送員版面 (/driver)
│   │   │   └── MobileDriverView.vue # 手機駕駛模擬導航版 (/mobile)
│   │   ├── router.js                # Vue Router 路由配置
│   │   ├── App.vue                  # 路由進入容器
│   │   └── main.js                  # 入口檔案 (載入 Leaflet CSS 與 Router)
│   └── package.json
├── server/                     # 後端 Express + WebSocket
│   ├── bin/
│   │   └── www                      # WebSocket 廣播核心與 OSRM 路由排程
│   ├── app.js                       # Express 伺服器配置
│   └── package.json
└── package.json                # Monorepo Concurrently 啟動配置