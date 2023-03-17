const { BrowserWindow, app, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { nanoid } = require('nanoid')
const { SpeechConfig, AudioConfig, SpeechSynthesizer } = require('microsoft-cognitiveservices-speech-sdk')
const sound = require('sound-play')
const _ = require('lodash')
const { Configuration, OpenAIApi } = require('openai')

const { config, history, STORE_PATH, LOG_PATH, AUDIO_PATH, SPEECH_AUDIO_PATH } = require('./utils/initFile.js')
const { getSpeechText } = require('./modules/speech.js')
const {
  OPENAI_API_KEY, USE_MODEL,
  SPEECH_KEY, SPEECH_AREA, SpeechSynthesisLanguage, SpeechSynthesisVoiceName,
  ADMIN_NAME, AI_NAME,
  speechPrompt,
} = config

let logFile = fs.createWriteStream(path.join(LOG_PATH, `log-${new Date().toLocaleString('zh-CN').replace(/[\/:]/gi, '-')}.txt`), {flags: 'w'})

const messageLogAndSend = (message)=>{
  logFile.write(format(new Date().toLocaleString('zh-CN'), JSON.stringify(message)) + '\n')
  mainWindow.webContents.send('send-message', message)
}

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

let mainWindow
function createWindow () {
  const win = new BrowserWindow({
    width: 960,
    height: 512,
    webPreferences: {
      webSecurity: app.isPackaged ? true : false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  })
  if (app.isPackaged) {
    win.loadFile('dist/index.html')
  } else {
    win.loadURL('http://localhost:5173')
  }
  win.setMenuBarVisibility(false)
  win.webContents.on('did-finish-load', ()=>{
    let name = require('./package.json').name
    let version = require('./package.json').version
    win.setTitle(name + ' ' + version)
  })
  win.once('ready-to-show', () => {
    win.show()
  })
  return win
}

app.whenReady()
.then(()=>{
  mainWindow = createWindow()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
  }
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const STATUS = {
  isSpeechTalk: false,
  isRecording: true,
}

let speechList = []

const speakPrompt = (text, audioFilename, triggerRecord) => {
  if (!audioFilename) audioFilename = nanoid()
  let audioPath = path.join(AUDIO_PATH, `${audioFilename}.wav`)
  const speechConfig = SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_AREA)
  speechConfig.speechSynthesisLanguage = SpeechSynthesisLanguage
  speechConfig.speechSynthesisVoiceName = SpeechSynthesisVoiceName
  const audioConfig = AudioConfig.fromAudioFileOutput(audioPath)
  const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig)
  synthesizer.speakTextAsync(
    text,
    async result => {
      synthesizer.close()
      await sound.play(audioPath)
      resolveSpeakTextList()
      if (triggerRecord && STATUS.isSpeechTalk) {
        STATUS.isRecording = true
        getSpeechText(openai, SPEECH_AUDIO_PATH)
        .then(adminTalk=>{
          STATUS.isRecording = false
          messageLogAndSend({
            id: nanoid(),
            from: `(${ADMIN_NAME})`,
            text: adminTalk
          })
          resloveAdminPrompt({prompt: adminTalk, triggerRecord: true})
        })
      }
    },
    error => {
      console.log(error)
      synthesizer.close()
    }
  )
}

const resolveSpeakTextList = async () => {
  if (speechList.length > 0) {
    let { text, audioFilename, triggerRecord } = speechList.shift()
    speakPrompt(text, audioFilename, triggerRecord)
  } else {
    setTimeout(resolveSpeakTextList, 1000)
  }
}

resolveSpeakTextList()

const resloveAdminPrompt = async ({prompt, triggerRecord})=> {
  let context = []
  for (let conversation of _.takeRight(history.conversationHistory, history.useHistory)) {
    context.push({role: 'user', content: conversation.user})
    context.push({role: 'assistant', content: conversation.assistant})
  }
  messages = [
    {role: 'system', content: speechPrompt},
    {role: 'user', content: `我和${AI_NAME}的对话内容?`},
    {role: 'assistant', content: history.memory},
    {role: 'user', content: `我的名字是${ADMIN_NAME}`},
    {role: 'assistant', content: `你好, ${ADMIN_NAME}`},
    ...context,
    {role: 'user', content: prompt}
  ]
  openai.createChatCompletion({
    model: USE_MODEL,
    messages,
  })
  .then(res=>{
    let resText = res.data.choices[0].message.content
    history.conversationHistory.push({
      user: prompt,
      assistant: resText.slice(0, 200)
    })
    history.conversationHistory = _.takeRight(history.conversationHistory, 20)
    history.useHistory += 1
    fs.writeFileSync(path.join(STORE_PATH, 'history.json'), JSON.stringify(history, null, '  '), {encoding: 'utf-8'})
    if (history.useHistory >= history.conversationLimit) {
      updateMemory()
    }
    messageLogAndSend({
      id: nanoid(),
      from: triggerRecord ? `(${AI_NAME})` : AI_NAME,
      text: resText
    })
    speechList.push({text: `${resText}`, triggerRecord})
  })
  .catch(e=>{
    console.log(e)
    STATUS.isSpeechTalk = false
  })
}

const updateMemory = ()=>{
  let context = []
  for (let conversation of _.takeRight(history.conversationHistory, history.useHistory)) {
    context.push({role: 'user', content: conversation.user})
    context.push({role: 'assistant', content: conversation.assistant})
  }
  let messages = [
    {role: 'system', content: speechPrompt},
    {role: 'user', content: `我和${AI_NAME}的对话内容?`},
    {role: 'assistant', content: history.memory},
    {role: 'user', content: `我的名字是${ADMIN_NAME}`},
    {role: 'assistant', content: `你好, ${ADMIN_NAME}`},
    ...context,
    {role: 'user', content: `${ADMIN_NAME}：总结你和我的对话内容,要强调细节`}
  ]
  openai.createChatCompletion({
    model: USE_MODEL,
    messages
  })
  .then(async res=>{
    history.memory = res.data.choices[0].message.content
    fs.writeFileSync(path.join(STORE_PATH, 'history.json'), JSON.stringify(history, null, '  '), {encoding: 'utf-8'})
  })
}

setInterval(()=>mainWindow.webContents.send('send-status', STATUS), 1000)
ipcMain.handle('send-prompt', async (event, text)=>{
  resloveAdminPrompt({prompt: text})
})
ipcMain.handle('get-admin-name', async (event)=>{
  return ADMIN_NAME
})
ipcMain.handle('open-config', async (event)=>{
  shell.openExternal(path.join(STORE_PATH, 'config.json'))
})
ipcMain.handle('switch-speech-talk', async ()=>{
  STATUS.isSpeechTalk = !STATUS.isSpeechTalk
  if (STATUS.isSpeechTalk) {
    STATUS.isRecording = true
    let adminTalk = await getSpeechText(openai, SPEECH_AUDIO_PATH)
    STATUS.isRecording = false
    messageLogAndSend({
      id: nanoid(),
      from: `(${ADMIN_NAME})`,
      text: adminTalk
    })
    resloveAdminPrompt({prompt: adminTalk, triggerRecord: true})
  }
})