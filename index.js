const { BrowserWindow, app, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { nanoid } = require('nanoid')
const sound = require('sound-play')
const _ = require('lodash')
const { Configuration, OpenAIApi } = require('openai')

const { config, history, STORE_PATH, LOG_PATH, AUDIO_PATH } = require('./utils/initFile.js')
const { getSpeechText } = require('./modules/whisper.js')
const { ttsPromise } = require('./modules/edge-tts.js')
const { openaiChat, openaiChatStream } = require('./modules/common.js')
const {
  OPENAI_API_KEY, DEFAULT_MODEL,
  SpeechSynthesisVoiceName,
  ADMIN_NAME, AI_NAME,
  systemPrompt,
  proxyObject
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

const speakPrompt = async (text, audioFilename, triggerRecord) => {
  try {
    if (!audioFilename) audioFilename = nanoid()
    let audioPath = path.join(AUDIO_PATH, `${audioFilename}.mp3`)
    await ttsPromise(text, audioPath, SpeechSynthesisVoiceName)
    await sound.play(audioPath)
    if (triggerRecord && STATUS.isSpeechTalk) triggerSpeech()
    resolveSpeakTextList()
  } catch (e) {
    console.log(e)
    resolveSpeakTextList()
  }
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
  let messages = [
    {role: 'system', content: systemPrompt},
    {role: 'user', content: `我的名字是${ADMIN_NAME}`},
    {role: 'assistant', content: `你好, ${ADMIN_NAME}`},
    ..._.takeRight(history, 10),
    {role: 'user', content: prompt}
  ]
  openai.createChatCompletion({
    model: DEFAULT_MODEL,
    messages,
  }, { proxyObject })
  .then(res=>{
    let resText = res.data.choices[0].message.content
    history.push(
      {role: 'user', content: prompt},
      {role: 'assistant', content: resText}
    )
    history = _.takeRight(history, 50)
    fs.writeFileSync(path.join(STORE_PATH, 'history.json'), JSON.stringify(history, null, '  '), {encoding: 'utf-8'})
    messageLogAndSend({
      id: nanoid(),
      from: triggerRecord ? `(${AI_NAME})` : AI_NAME,
      text: resText
    })
    if (triggerRecord) speechList.push({text: `${resText}`, triggerRecord})
  })
  .catch(e=>{
    console.log(e)
    STATUS.isSpeechTalk = false
  })
}


const triggerSpeech = async ()=>{
  STATUS.isRecording = true
  mainWindow.setProgressBar(100, {mode: 'indeterminate'})
  let adminTalk = await getSpeechText()
  STATUS.isRecording = false
  mainWindow.setProgressBar(-1)
  messageLogAndSend({
    id: nanoid(),
    from: `(${ADMIN_NAME})`,
    text: adminTalk
  })
  resloveAdminPrompt({prompt: adminTalk, triggerRecord: true})
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
  mainWindow.setProgressBar(-1)
  if (STATUS.isSpeechTalk) {
    triggerSpeech()
  }
})