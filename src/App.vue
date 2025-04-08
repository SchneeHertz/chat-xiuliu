<script setup>
import { onMounted, ref, nextTick } from 'vue'
import { nanoid } from 'nanoid'
import { Microphone, MicrophoneSlash, ImageRegular } from '@vicons/fa'
import { Speaker216Filled, SpeakerOff16Filled, DismissCircle16Regular, DocumentPdf16Regular, Send16Regular } from '@vicons/fluent'
import html2canvas from 'html2canvas'

import { useMainStore } from './pinia.js'
const mainStore = useMainStore()

import Setting from './components/Setting.vue'
import Message from './components/Message.vue'
import MessageList from './components/MessageList.vue'

const messageRef = ref(null)
const printMessage = (type, msg, option) => {
  messageRef.value.message.destroyAll()
  messageRef.value.message[type](msg, option)
}

const messageListRef = ref(null)

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
    let userPrompt = {
      type: 'array',
      content: [
        ...imageBlobUrlList.value.map((url) => {
          return {
            type: 'image_url',
            image_url: {
              detail: 'auto',
              url
            }
          }
        }),
        {
          type: 'text',
          text: inputText.value
        },
      ],
      useFullPDF: useFullPDF.value
    }
    ipcRenderer.invoke('send-prompt', userPrompt)
    messageListRef.value.addUserMessage({
      id: nanoid(),
      from: config.value.ADMIN_NAME,
      ...userPrompt
    })
    imageBlobUrlList.value = []
    showImagePopover.value = false
  } else {
    let userPrompt = {
      type: 'string',
      content: inputText.value,
      useFullPDF: useFullPDF.value
    }
    ipcRenderer.invoke('send-prompt', userPrompt)
    messageListRef.value.addUserMessage({
      id: nanoid(),
      from: config.value.ADMIN_NAME,
      ...userPrompt
    })
  }
  nextTick(() => scrollToBottom('message-list'))
  inputText.value = ''
}

const scrollToBottom = (id) => {
  const element = document.getElementById(id)
  element.scrollTop = element.scrollHeight
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

// config
const setting = ref(null)
const config = ref({})
onMounted(async () => {
  config.value = await ipcRenderer.invoke('load-setting')
  if (!config.value.OPENAI_API_KEY && !config.value.AZURE_OPENAI_KEY) {
    setting.value.openConfig()
    printMessage('error', '请先设置 API_KEY', { duration: 5000 })
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
  mainStore.messageList = []
  ipcRenderer.invoke('remove-context')
}
const saveCapture = async () => {
  const screenshotTarget = document.querySelector('#message-list')
  screenshotTarget.style['padding-left'] = '16px'
  const canvas = await html2canvas(screenshotTarget, {
    useCORS: true,
    width: screenshotTarget.offsetWidth + 16,
    // windowWidth: screenshotTarget.offsetWidth,
    height: screenshotTarget.scrollHeight + 24,
    windowHeight: screenshotTarget.scrollHeight + 120,
  })
  screenshotTarget.style['padding-left'] = '0'
  const base64image = canvas.toDataURL('image/jpeg', 0.85)
  let exportFileDefaultName = 'export.jpg'
  let linkElement = document.createElement('a')
  linkElement.setAttribute('href', base64image)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}

const choosePdfFile = async () => {
  const filepath = await ipcRenderer.invoke('select-file', { filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (filepath) await ipcRenderer.invoke('resolve-pdf', filepath)
}

const useFullPDF = ref(false)

const showSavedMessage = ref(false)
const switchMessageList = () => {
  showSavedMessage.value = !showSavedMessage.value
  if (showSavedMessage.value) {
    mainStore.tempMessageList = _.cloneDeep(mainStore.messageList)
    mainStore.messageList = _.cloneDeep(mainStore.savedMessageList)
  } else {
    mainStore.messageList = _.cloneDeep(mainStore.tempMessageList)
  }
  nextTick(messageListRef.value.applyRender)
}

const simpleContinue = () => {
  let userPrompt = {
    type: 'string',
    content: '继续',
    useFullPDF: useFullPDF.value
  }
  ipcRenderer.invoke('send-prompt', userPrompt)
  messageListRef.value.addUserMessage({
    id: nanoid(),
    from: config.value.ADMIN_NAME,
    ...userPrompt
  })
  nextTick(() => scrollToBottom('message-list'))
}

</script>

<template>
  <n-grid x-gap="12" :cols="24" style="width: 100%">
    <n-gi :offset="1" :span="22">
      <MessageList
        ref="messageListRef"
        :config="config"
        @message="printMessage"
      />
      <n-input-group style="margin-top: 8px">
        <n-upload
          :show-file-list="false"
          accept="image/png,image/jpeg,image/webp"
          :multiple="true"
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
              <div v-for="(imageBlobUrl, index) in imageBlobUrlList" class="image-frame">
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
        <n-button style="height: 36px" @click="choosePdfFile">
          <template #icon>
            <n-icon><DocumentPdf16Regular /></n-icon>
          </template>
        </n-button>
        <n-input :value="inputText" @update:value="updateInputText" @keydown.enter="sendText"
          @paste="handleImagePaste"
          ref="inputArea" class="input-text" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }"
          :disabled="showSavedMessage"
        ></n-input>
        <n-button
          style="height: 36px"
          @click="sendText"
          :disabled="showSavedMessage"
        >
          <template #icon>
            <n-icon><Send16Regular /></n-icon>
          </template>
        </n-button>
        <n-button type="primary" @click="simpleContinue" style="height: 36px">继续</n-button>
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
        <Setting ref="setting"/>
        <n-button :type="useFullPDF ? 'primary' : 'default'" secondary @click="useFullPDF = !useFullPDF">使用完整PDF</n-button>
        <n-button type="primary" tertiary @click="saveCapture">保存对话截图</n-button>
        <n-button type="primary" tertiary @click="emptyHistory">清除对话历史</n-button>
        <n-button type="primary" tertiary @click="switchMessageList">{{showSavedMessage ? '显示对话' : '显示已保存内容'}}</n-button>
      </n-space>
    </n-gi>
  </n-grid>
  <n-message-provider><Message ref="messageRef"/></n-message-provider>
</template>

<style lang="stylus">
.image-frame
  position: relative
  .upload-image-close
    position: absolute
    right: 4px
    bottom: 10px

#function-button
  margin-top: 8px
  margin-bottom: 12px
</style>
