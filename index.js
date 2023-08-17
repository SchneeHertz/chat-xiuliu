const { BrowserWindow, app, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { nanoid } = require('nanoid')
const sound = require('sound-play')
const _ = require('lodash')
const lancedb = require('vectordb')

const { STORE_PATH, LOG_PATH, AUDIO_PATH, SPEECH_AUDIO_PATH } = require('./utils/initFile.js')
const { getStore, setStore } = require('./modules/store.js')
const { getSpeechText } = require('./modules/whisper.js')
const { ttsPromise } = require('./modules/edge-tts.js')
const { openaiChat, openaiChatStream, openaiEmbedding } = require('./modules/common.js')
const { functionAction, functionInfo, functionList } = require('./modules/functions.js')
const {config: {
  DEFAULT_MODEL,
  ADMIN_NAME, AI_NAME,
  systemPrompt
}} = require('./utils/loadConfig.js')

const logFile = fs.createWriteStream(path.join(LOG_PATH, `log-${new Date().toLocaleString('zh-CN').replace(/[\/:]/gi, '-')}.txt`), {flags: 'w'})
const messageLog = (message)=>{
  logFile.write(format(new Date().toLocaleString('zh-CN'), JSON.stringify(message)) + '\n')
}
const messageSend = (message)=>{
  mainWindow.webContents.send('send-message', message)
}
const messageLogAndSend = (message)=>{
  messageLog(message)
  messageSend(message)
}

let memoryTable

const STATUS = {
  isSpeechTalk: false,
  isRecording: true,
  speakIndex: 0,
}

let speakTextList = []

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
.then(async ()=>{
  const memorydb = await lancedb.connect(path.join(STORE_PATH, 'memorydb'))
  const embedding = {
    sourceColumn:'text',
    embed: async (batch)=>{
      let result = []
      for (let text of batch) {
        result.push(await openaiEmbedding({input: text}))
      }
      return result
    }
  }
  try {
    memoryTable = await memorydb.openTable('memory', embedding)
  } catch {
    try {
      memoryTable = await memorydb.createTable('memory', [{'text': 'Hello world!'}], embedding)
    } catch {}
  }
  mainWindow = createWindow()
  setInterval(()=>mainWindow.webContents.send('send-status', STATUS), 1000)
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

const speakPrompt = async ({text, preAudioPath}) => {
  try {
    let nextAudioPath = path.join(AUDIO_PATH, `${nanoid()}.mp3`)
    if (text) {
      if (preAudioPath) {
        await Promise.allSettled([
          ttsPromise(text, nextAudioPath),
          sound.play(preAudioPath)
        ])
      } else {
        await ttsPromise(text, nextAudioPath)
      }
      resolveSpeakTextList(nextAudioPath)
    } else if (preAudioPath) {
      await sound.play(preAudioPath)
      triggerSpeech()
      resolveSpeakTextList()
    }
  } catch (e) {
    console.log(e)
    resolveSpeakTextList()
  }
}

const resolveSpeakTextList = async (preAudioPath) => {
  speakTextList = _.sortBy(speakTextList, 'speakIndex')
  if (preAudioPath) {
    if (speakTextList.length > 0) {
      let { text } = speakTextList.shift()
      speakPrompt({text, preAudioPath})
    } else {
      speakPrompt({preAudioPath})
    }
  } else if (speakTextList.length > 0) {
    let { text } = speakTextList.shift()
    speakPrompt({text})
  } else {
    setTimeout(resolveSpeakTextList, 1000)
  }
}

resolveSpeakTextList()

const resloveAdminPrompt = async ({prompt, triggerRecord})=> {
  let from = triggerRecord ? `(${AI_NAME})` : AI_NAME
  let history = getStore('history')
  let messages = [
    {role: 'system', content: systemPrompt},
    {role: 'user', content: `我的名字是${ADMIN_NAME}`},
    {role: 'assistant', content: `你好, ${ADMIN_NAME}`},
    ..._.takeRight(history, 12),
    {role: 'user', content: prompt}
  ]

  let resContent = ''
  let resFunction
  let resArgument = ''
  await openaiChat({
    model: DEFAULT_MODEL,
    messages,
    functions: functionInfo
  })
  .then(async res=>{
    resContent = res.choices[0].message.content
    resFunction = res.choices[0].message?.function_call?.name
    resArgument = res.choices[0].message?.function_call?.arguments
    if (resFunction && resArgument) {
      messageLogAndSend({
        id: nanoid(),
        from,
        text: functionAction[resFunction](JSON.parse(resArgument))
      })
      let functionCallResult
      try {
        switch (resFunction) {
          case 'getHistoricalConversationContent':
            functionCallResult = await functionList[resFunction](_.assign({dbTable: memoryTable}, JSON.parse(resArgument)))
            break
          default:
            functionCallResult = await functionList[resFunction](JSON.parse(resArgument))
            break
        }
      } catch (e) {
        console.log(e)
        functionCallResult = ''
      }
      let functionCalling = [res.choices[0].message, {role: "function", name: resFunction, content: functionCallResult}]
      messages.push(...functionCalling)
      history.push(...functionCalling)
      history = _.takeRight(history, 50)
      setStore('history', history)
      if (functionCallResult) console.log(functionCalling)
    }
  })
  .catch(e=>console.log(e))

  let resTextTemp = ''
  let resText = ''
  let clientMessageId = nanoid()
  let speakIndex = STATUS.speakIndex
  STATUS.speakIndex += 1

  try {
    if (resContent && !resFunction) {
      resText = resContent
      messageSend({
        id: clientMessageId,
        from,
        text: resText
      })
      let splitResText = resContent.split('\n')
      splitResText = _.compact(splitResText)
      for (let paragraph of splitResText ){
        let speakText = paragraph.replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
        speakTextList.push({
          text: `${speakText}`,
          speakIndex
        })
      }
    } else {
      for await (const token of openaiChatStream({
        model: DEFAULT_MODEL,
        messages,
      })) {
        resTextTemp += token
        resText += token
        messageSend({
          id: clientMessageId,
          from,
          text: resText
        })
        if (triggerRecord) {
          if (resTextTemp.includes('\n')) {
            let splitResText = resTextTemp.split('\n')
            splitResText = _.compact(splitResText)
            if (splitResText.length > 1) {
              resTextTemp = splitResText.pop()
            } else {
              resTextTemp = ''
            }
            let pickFirstParagraph = splitResText.join('\n')
            let speakText = pickFirstParagraph.replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
            speakTextList.push({
              text: speakText,
              speakIndex,
            })
          }
        }
      }
    }
    if (triggerRecord) {
      if (resTextTemp) {
        let speakText = resTextTemp.replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
        speakTextList.push({
          text: speakText,
          speakIndex,
        })
      }
    }
    history.push({role: 'assistant', content: resText})
    history = _.takeRight(history, 50)
    setStore('history', history)
    memoryTable.add([{text: resText}])
  } catch (e) {
    console.log(e)
    if (triggerRecord && STATUS.isSpeechTalk) triggerSpeech()
  }
}


const triggerSpeech = async ()=>{
  while (STATUS.isSpeechTalk) {
    STATUS.isRecording = true
    mainWindow.setProgressBar(100, {mode: 'indeterminate'})
    let adminTalk = await getSpeechText()
    if (adminTalk.startsWith(AI_NAME)) {
      STATUS.isRecording = false
      mainWindow.setProgressBar(-1)
      messageLogAndSend({
        id: nanoid(),
        from: `(${ADMIN_NAME})`,
        text: adminTalk
      })
      resloveAdminPrompt({prompt: adminTalk, triggerRecord: true})
      break
    }
  }
}

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