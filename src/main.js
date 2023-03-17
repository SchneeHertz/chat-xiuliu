import { createApp } from 'vue'
import App from './App.vue'
import _ from 'lodash'


window._ = _

const app = createApp(App)
app.mount('#app')