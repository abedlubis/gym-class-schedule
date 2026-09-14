import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { installPrimeVue } from './plugins/primevue'

const app = createApp(App)
installPrimeVue(app)
app.use(router).mount('#app')
