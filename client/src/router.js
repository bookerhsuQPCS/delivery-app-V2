import { createRouter, createWebHistory } from 'vue-router';
import AdminView from './views/AdminView.vue';
import DriverView from './views/DriverView.vue';
import MobileDriverView from './views/MobileDriverView.vue';

const routes = [
  { path: '/', redirect: '/admin' },
  { path: '/admin', name: 'Admin', component: AdminView },
  { path: '/driver', name: 'Driver', component: DriverView },
  { path: '/mobile', name: 'MobileDriver', component: MobileDriverView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;