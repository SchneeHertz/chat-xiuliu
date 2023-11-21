<script setup>
import { onMounted, ref, nextTick } from 'vue'
import { nanoid } from 'nanoid'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { Microphone, MicrophoneSlash, UserCircle, ImageRegular } from '@vicons/fa'
import { Speaker216Filled, SpeakerOff16Filled, DismissCircle16Regular } from '@vicons/fluent'
import html2canvas from 'html2canvas'

import CopyButtonPlugin from 'highlightjs-copy'
hljs.addPlugin(new CopyButtonPlugin())

import Setting from './components/Setting.vue'
import Message from './components/Message.vue'
import XiuliuAvatar from './assets/xiuliu_avatar.jpg'
import ChatAvatar from './assets/chatgpt.svg'

const messageRef = ref(null)
const printMessage = (type, msg, option) => {
  messageRef.value.message.destroyAll()
  messageRef.value.message[type](msg, option)
}

const messageHistory = ref([])

const renderCodeBlocks = (text) => {
  return text.replace(/```(\w+)\n((?:(?!```)[\s\S])*)(?:```)?/g, (match, language, code) => {
    return `<pre class="code-block${language ? ` language-${language}` : ''}"><code class="${language ? `language-${language}` : ''}">${code.trim()}</code></pre>`
  })
}
const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

onMounted(() => {
  ipcRenderer.on('send-message', (event, arg) => {
    if (arg.action === 'revoke') {
      messageHistory.value = _.filter(messageHistory.value, m => m.id !== arg.id)
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
    let findExist = _.find(messageHistory.value, { id: arg.id })
    if (findExist) {
      findExist.text = arg.text
      findExist.tokenCount = arg.tokenCount
      findExist.countToken = arg.countToken
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
  ipcRenderer.invoke('load-history')
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
  if (imageBlobUrlList.value.length > 0) {
    ipcRenderer.invoke('send-prompt', {
      type: 'array',
      content: [
        {
          type: 'text',
          text: inputText.value
        },
        ...imageBlobUrlList.value.map((url) => {
          return {
            type: 'image_url',
            image_url: {
              detail: 'auto',
              url
            }
          }
        })
      ]
    })
    messageHistory.value.push({
      id: nanoid(),
      from: config.value.ADMIN_NAME,
      text: inputText.value,
      images: imageBlobUrlList.value
    })
    imageBlobUrlList.value = []
    showImagePopover.value = false
  } else {
    ipcRenderer.invoke('send-prompt', {
      type: 'string',
      content: inputText.value
    })
    messageHistory.value.push({
      id: nanoid(),
      from: config.value.ADMIN_NAME,
      text: inputText.value
    })
  }
  nextTick(() => scrollToBottom('message-list'))
  inputText.value = ''
}
const scrollToBottom = (id) => {
  const element = document.getElementById(id)
  element.scrollTop = element.scrollHeight
}

// config
const setting = ref(null)
const config = ref({})
onMounted(async () => {
  config.value = await ipcRenderer.invoke('load-setting')
  if (!config.value.OPENAI_API_KEY && !config.value.AZURE_OPENAI_KEY) {
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
  messageHistory.value = []
}
const saveCapture = async () => {
  const screenshotTarget = document.querySelector('#message-list')
  screenshotTarget.style['padding-left'] = '32px'
  const canvas = await html2canvas(screenshotTarget, {
    width: screenshotTarget.clientWidth - 70,
    windowWidth: screenshotTarget.clientWidth,
    height: screenshotTarget.scrollHeight + 24,
    windowHeight: screenshotTarget.scrollHeight + 120
  })
  screenshotTarget.style['padding-left'] = '0'
  const base64image = canvas.toDataURL('image/png', 0.85)
  let exportFileDefaultName = 'export.png'
  let linkElement = document.createElement('a')
  linkElement.setAttribute('href', base64image)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}

const imageBlobUrlList = ref([])
const showImagePopover = ref(false)
const resolveImage = async ({ file, onFinish }) => {
  const reader = new FileReader()
  reader.onload = (evt) => {
    imageBlobUrlList.value.push(evt.target.result)
    showImagePopover.value = true
    onFinish()
  }
  reader.readAsDataURL(file.file)
}
const handleImagePaste = (event) => {
  const items = event.clipboardData.items
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image')) {
      const blob = items[i].getAsFile()
      const reader = new FileReader()
      reader.onload = (evt) => {
        imageBlobUrlList.value.push(evt.target.result)
        showImagePopover.value = true
      }
      reader.readAsDataURL(blob)
    }
  }
}
const removeImage = (index) => {
  imageBlobUrlList.value.splice(index, 1)
  if (imageBlobUrlList.value.length === 0) {
    showImagePopover.value = false
  }
}

</script>

<template>
  <n-grid x-gap="12" :cols="24">
    <n-gi :offset="1" :span="22">
      <n-list id="message-list">
        <n-card v-for="message in messageHistory" :key="message.id" class="message-card">
          <n-thing>
            <template #avatar>
              <n-avatar v-if="[config.ADMIN_NAME, `(${config.ADMIN_NAME})`, '群聊'].includes(message.from)" size="small">
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
      </n-list>
      <n-input-group style="margin-top: 4px">
        <n-upload
          :show-file-list="false"
          :custom-request="resolveImage"
          style="width: auto"
        >
          <n-popover trigger="manual" :show="showImagePopover">
            <template #trigger>
              <n-button style="height: 36px">
                <template #icon>
                  <n-icon><ImageRegular /></n-icon>
                </template>
              </n-button>
            </template>
            <div class="image-container">
              <div v-for="(imageBlobUrl, index) in imageBlobUrlList">
                <n-image
                  :img-props="{style: 'max-width: 200px'}"
                  :src="imageBlobUrl"
                />
                <n-button text type="error" class="upload-image-close" @click="removeImage(index)">
                  <template #icon>
                    <n-icon><DismissCircle16Regular /></n-icon>
                  </template>
                </n-button>
              </div>
            </div>
          </n-popover>
        </n-upload>
        <n-input :value="inputText" @update:value="updateInputText" @keydown.enter="sendText"
          @paste="handleImagePaste"
          ref="inputArea" class="input-text" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }"
        ></n-input>
      </n-input-group>
    </n-gi>
    <n-gi :offset="1" :span="22">
      <n-space id="function-button">
        <n-button tertiary :type="isSpeechTalk
          ? recordStatus === 'Recording'
            ? 'error'
            : recordStatus === 'Recognizing'
              ? 'warning'
              : 'primary'
          : 'default'" @click="switchSpeechTalk"
        >
          <template #icon>
            <n-icon>
              <Microphone v-if="isSpeechTalk" />
              <MicrophoneSlash v-else />
            </n-icon>
          </template>
        </n-button>
        <n-button tertiary :type="isAudioPlay ? 'primary' : 'default'" @click="switchAudio">
          <template #icon>
            <n-icon>
              <Speaker216Filled v-if="isAudioPlay" />
              <SpeakerOff16Filled v-else />
            </n-icon>
          </template>
        </n-button>
        <n-button type="primary" tertiary @click="saveCapture">保存对话截图</n-button>
        <n-button type="primary" tertiary @click="emptyHistory">清除对话历史</n-button>
        <Setting ref="setting"/>
      </n-space>
    </n-gi>
  </n-grid>
  <n-message-provider><Message ref="messageRef"/></n-message-provider>
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


.upload-image-close
  position: relative
  left: -20px
  bottom: 1px

#function-button
  margin-top: 8px
  margin-bottom: 12px
</style>
