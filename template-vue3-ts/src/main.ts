import { createApp } from 'vue'

import App from './App.vue'
import { setupStore } from './stores'
import { setupRouter, setupRouterGuard } from './router'

import './assets/main.css'

function bootstrap() {
  const app = createApp(App)

  // store
  setupStore(app)

  // router
  setupRouter(app)

  // router guard
  setupRouterGuard()

  app.mount('#app')
}

bootstrap()
