import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import _ from 'lodash'


window._ = _
const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.mount('#app')