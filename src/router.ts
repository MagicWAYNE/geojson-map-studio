import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/district/:name', name: 'district', component: () => import('@/views/DistrictView.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
