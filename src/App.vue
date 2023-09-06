<script setup>
import { onMounted, ref, nextTick } from 'vue'
import { nanoid } from 'nanoid'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { Microphone, MicrophoneSlash } from '@vicons/fa'
import { Speaker216Filled, SpeakerOff16Filled } from '@vicons/fluent'

import CopyButtonPlugin from 'highlightjs-copy'
hljs.addPlugin(new CopyButtonPlugin())

import Setting from './components/Setting.vue'
import Message from './components/Message.vue'

const messageRef = ref(null)
const printMessage = (type, msg, option) => {
  messageRef.value.message.destroyAll()
  messageRef.value.message[type](msg, option)
}

const messageHistory = ref([])

let ADMIN_NAME
onMounted(() => ipcRenderer.invoke('get-admin-name').then(name => ADMIN_NAME = name))

const renderCodeBlocks = (text) => {
  return text.replace(/```([\w-]+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
    return `<pre class="code-block${language ? ` language-${language}` : ''}"><code class="${language ? `language-${language}` : ''}">${code.trim()}</code></pre>`
  })
}
const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

onMounted(() => {
  ipcRenderer.on('send-message', (event, arg) => {
    arg.text = renderCodeBlocks(escapeHtml(arg.text))
    let findExist = _.find(messageHistory.value, { id: arg.id })
    if (findExist) {
      findExist.text = arg.text
    } else {
      messageHistory.value.push(arg)
      messageHistory.value = _.takeRight(messageHistory.value, 1000)
    }
    nextTick(() => {
      scrollToBottom('message-list')
      document.querySelectorAll('pre.code-block code:not(.hljs)').forEach((el) => {
        hljs.highlightElement(el)
      })
    })
  })
})
const inputText = ref('')
const inputArea = ref(null)
const updateInputText = (value) => {
  inputText.value = value
}
const sendText = (event) => {
  let textareaElement = inputArea.value.wrapperElRef.children[0].children[0].children[0]
  event.preventDefault()
  if (event.shiftKey) {
    let pos = textareaElement.selectionStart
    inputText.value = inputText.value.slice(0, pos) + '\n' + inputText.value.slice(pos)
    textareaElement.value = inputText.value
    textareaElement.selectionStart = textareaElement.selectionEnd = pos + 1
    return
  }
  ipcRenderer.invoke('send-prompt', inputText.value)
  messageHistory.value.push({
    id: nanoid(),
    from: ADMIN_NAME,
    text: inputText.value
  })
  nextTick(() => scrollToBottom('message-list'))
  inputText.value = ''
}
const scrollToBottom = (id) => {
  const element = document.getElementById(id)
  element.scrollTop = element.scrollHeight
}
// API Key Check
const setting = ref(null)
onMounted(async () => {
  let config = await ipcRenderer.invoke('load-setting')
  if (!config.OPENAI_API_KEY && !config.AZURE_OPENAI_KEY) {
    setting.value.openConfig()
    printMessage('error', '请先设置 OPENAI_API_KEY', { duration: 5000 })
  }
})


// STATUS
const isSpeechTalk = ref(false)
const recordStatus = ref(false)
const isAudioPlay = ref(false)
onMounted(() => {
  ipcRenderer.on('send-status', (event, arg) => {
    isSpeechTalk.value = arg.isSpeechTalk
    isAudioPlay.value = arg.isAudioPlay
    recordStatus.value = arg.recordStatus
  })
})
const switchSpeechTalk = () => {
  ipcRenderer.invoke('switch-speech-talk')
}
const switchAudio = () => {
  ipcRenderer.invoke('switch-audio')
}
const emptyHistory = () => {
  ipcRenderer.invoke('empty-history')
}

</script>

<template>
  <n-grid x-gap="12" :cols="24">
    <n-gi :offset="1" :span="22">
      <n-list id="message-list">
        <n-card
          v-for="message in messageHistory"
          :key="message.id"
          :title="message.from"
          :class="{'message-right': [ADMIN_NAME, `(${ADMIN_NAME})`].includes(message.from)}"
          class="message-card"
          embedded
        >
          <pre v-html="message.text" :class="{'message-right-text': [ADMIN_NAME, `(${ADMIN_NAME})`].includes(message.from)}"></pre>
        </n-card>
      </n-list>
      <n-input class="input-text" :value="inputText" @update:value="updateInputText" @keydown.enter="sendText" ref="inputArea"
        type="textarea" :autosize="{ minRows: 1, maxRows: 6 }"></n-input>
    </n-gi>
    <n-gi :offset="1" :span="22" id="function-button">
      <n-space>
        <n-button round :type="isSpeechTalk
          ? recordStatus === 'Recording'
            ? 'error'
            : recordStatus === 'Recognizing'
              ? 'warning'
              : 'primary'
          : 'default'" @click="switchSpeechTalk">
          <template #icon>
            <n-icon><Microphone v-if="isSpeechTalk" /><MicrophoneSlash v-else /></n-icon>
          </template>
        </n-button>
        <n-button round :type="isAudioPlay ? 'primary' : 'default'" @click="switchAudio">
          <template #icon>
            <n-icon><Speaker216Filled v-if="isAudioPlay" /><SpeakerOff16Filled v-else /></n-icon>
          </template>
        </n-button>
        <n-button type="primary" tertiary @click="emptyHistory">清除对话历史</n-button>
        <Setting ref="setting"/>
      </n-space>
    </n-gi>
  </n-grid>
  <n-message-provider>
    <Message ref="messageRef"/>
  </n-message-provider>
</template>

<style lang="stylus">
#message-list
  max-height: calc(100vh - 85px)
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
.message-right
  text-align: right
.message-right-text
  text-align: left
  float: right

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

.input-text
  margin-top: 4px
#function-button
  margin-top: 6px
</style>
