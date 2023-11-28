<script setup>
import { onMounted, ref, nextTick } from 'vue'
import { UserCircle } from '@vicons/fa'
import { LogoOctocat } from '@vicons/ionicons4'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

import CopyButtonPlugin from 'highlightjs-copy'
hljs.addPlugin(new CopyButtonPlugin())

import XiuliuAvatar from '../assets/xiuliu_avatar.jpg'
import ChatAvatar from '../assets/chatgpt.svg'

import { useMainStore } from '../pinia.js'
const mainStore = useMainStore()

const props = defineProps({
  config: {
    type: Object,
    default: () => ({})
  }
})

const renderCodeBlocks = (text) => {
  return text.replace(/```(\w+)\n((?:(?!```)[\s\S])*)(?:```)?/g, (match, language, code) => {
    return `<pre class="code-block${language ? ` language-${language}` : ''}"><code class="${language ? `language-${language}` : ''}">${code.trim()}</code></pre>`
  })
}
const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const scrollToBottom = (id) => {
  const element = document.getElementById(id)
  element.scrollTop = element.scrollHeight
}

onMounted(() => {
  ipcRenderer.on('send-message', (event, arg) => {
    if (arg.action === 'revoke') {
      mainStore.messageList = _.filter(mainStore.messageList, m => m.id !== arg.id)
      return
    }
    if (typeof arg.content === 'string') {
      arg.text = renderCodeBlocks(escapeHtml(arg.content))
    } else {
      arg.text = ''
      arg.images = []
      arg.content.forEach((item) => {
        switch (item.type) {
          case 'text':
            arg.text += renderCodeBlocks(escapeHtml(item.text)) + '\n'
            break
          case 'image_url':
            arg.images.push(item.image_url.url)
            break
        }
      })
    }
    let findExist = _.find(mainStore.messageList, { id: arg.id })
    if (findExist) {
      findExist.text = arg.text
      findExist.tokenCount = arg.tokenCount
      findExist.countToken = arg.countToken
    } else {
      mainStore.messageList.push(arg)
      mainStore.messageList = _.takeRight(mainStore.messageList, 200)
    }
    nextTick(() => {
      scrollToBottom('message-list')
      document.querySelectorAll('pre.code-block code:not(.hljs)').forEach((el) => {
        hljs.highlightElement(el)
      })
    })
  })
  ipcRenderer.invoke('load-history')
})
</script>

<template>
  <n-list id="message-list">
    <n-card v-for="message in mainStore.messageList" :key="message.id" class="message-card">
      <n-thing>
        <template #avatar>
          <n-avatar v-if="[props.config?.ADMIN_NAME, `(${props.config?.ADMIN_NAME})`, '群聊'].includes(message.from)" size="small">
            <n-icon><UserCircle /></n-icon>
          </n-avatar>
          <n-avatar v-else size="small" :src="XiuliuAvatar"></n-avatar>
        </template>
        <template #header>
          {{message.from}}
        </template>
        <pre v-html="message.text"></pre>
        <div v-if="message.images" class="image-container">
          <n-image :img-props="{style: 'max-width: 512px; margin-top: 4px;'}" v-for="image in message.images" :src="image"/>
        </div>
        <n-spin size="small" v-if="!message.text" />
        <p v-if="message.countToken" class="token-count">Used {{ message.tokenCount }} tokens</p>
      </n-thing>
    </n-card>
    <n-empty description="喵有记录" v-if="mainStore.messageList.length === 0" size="large" style="margin: 10px 0">
      <template #icon>
        <n-icon>
          <LogoOctocat />
        </n-icon>
      </template>
    </n-empty>
  </n-list>
</template>

<style lang="stylus">
#message-list
  margin-top: 8px
  max-height: calc(100vh - 104px)
  overflow-y: auto
.message-card
  margin: 4px 0 6px
  .n-card-header
    padding: 10px 26px 0
  .n-card-content
    padding: 0 26px
  pre
    font-family: Avenir, Helvetica, Arial, sans-serif
    white-space: break-spaces
  .image-container
    display: grid

.token-count
  font-size: 12px
  color: #999

.code-block
  position: relative
  code.hljs
    border-radius: 4px
.hljs-copy-button
  position: absolute
  right: 4px
  top: 4px
.hljs-copy-alert
  display: none
</style>
