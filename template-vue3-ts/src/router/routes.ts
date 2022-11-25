import type { RouteRecordRaw } from 'vue-router'
import PageLayout from '@/layout/PageLayout.vue'
import NotFound from '@/views/NotFound.vue'
import moduleRoutes from './modules'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: PageLayout,
    children: moduleRoutes
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
]

export default routes
