<script setup>
  import { onMounted, ref, nextTick } from 'vue'
  import { nanoid } from 'nanoid'
  const messageHistory = ref([])
  let ADMIN_NAME

  onMounted(()=>{
    ipcRenderer['get-admin-name']()
    .then(name=>{
      ADMIN_NAME = name
    })
    ipcRenderer['send-message']((event, arg)=>{
      messageHistory.value.push(arg)
      messageHistory.value = _.takeRight(messageHistory.value, 1000)
      nextTick(()=>scrollToBottom('message-list'))
    })
  })
  const inputText = ref('')
  const sendText = ()=>{
    ipcRenderer['send-prompt'](inputText.value)
    messageHistory.value.push({
      id: nanoid(),
      from: ADMIN_NAME,
      text: inputText.value
    })
    nextTick(()=>scrollToBottom('message-list'))
    inputText.value = ''
  }
  const scrollToBottom = (id) => {
      const element = document.getElementById(id)
      element.scrollTop = element.scrollHeight
  }
  const isSpeechTalk = ref(false)
  const isRecording = ref(false)
  onMounted(()=>{
    ipcRenderer['send-status']((event, arg)=>{
      isSpeechTalk.value = arg.isSpeechTalk
      isRecording.value = arg.isRecording
    })
  })
  const switchSpeechTalk = ()=>{
    ipcRenderer['switch-speech-talk']()
  }
  const openConfig = ()=>{
    ipcRenderer['open-config']()
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
          <pre>{{message.text}}</pre>
        </n-card>
      </n-list>
      <n-input-group class="input-text">
        <n-input v-model:value="inputText" @keyup.enter="sendText"></n-input>
        <n-button @click="sendText">Send</n-button>
      </n-input-group>
    </n-gi>
    <n-gi :offset="1" :span="22" id="function-button">
      <n-button :type="isSpeechTalk ? isRecording ? 'error' : 'primary'  : 'default'" @click="switchSpeechTalk">{{ isSpeechTalk ? isRecording ? 'Recording' : 'Answering' : 'Speech Off' }}</n-button>
      <n-button type="default" @click="openConfig">Open Config</n-button>
    </n-gi>
  </n-grid>
</template>

<style lang="stylus">
#message-list
  max-height: calc(100vh - 85px)
  overflow-y: auto
  padding-right: 10px
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
.input-text
  margin-top: 4px
#function-button
  margin-top: 6px
  .n-button
    margin-right: 8px!important
</style>
