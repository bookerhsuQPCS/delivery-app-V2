// File: client/src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import OrderView from './views/OrderView.vue';
import MobileDriverView from './views/MobileDriverView.vue';
import MonitorView from './views/MonitorView.vue';

const routes = [
  {
    path: '/',
    redirect: '/order'
  },
  {
    path: '/driver',
    name: 'driver',
    component: MobileDriverView
  },
  {
    path: '/mobile',
    name: 'mobile',
    component: MobileDriverView
  },
  {
    path: '/monitor',
    name: 'monitor',
    component: MonitorView
  },
  {
    path: '/order',
    name: 'order',
    component: OrderView
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;