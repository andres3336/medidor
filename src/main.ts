import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initRouter } from './lib/router.svelte'
import { initTheme } from './lib/theme.svelte'

initTheme()
initRouter()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
