const { BrowserWindow, app, ipcMain, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { nanoid } = require('nanoid')
const sound = require('sound-play')
const _ = require('lodash')
const lancedb = require('vectordb')

const { STORE_PATH, LOG_PATH, AUDIO_PATH } = require('./utils/initFile.js')
const { getStore, setStore } = require('./modules/store.js')
const { getSpeechText } = require('./modules/whisper.js')
const { ttsPromise } = require('./modules/edge-tts.js')
const { openaiChatStream, openaiEmbedding, azureOpenaiChatStream, azureOpenaiEmbedding } = require('./modules/common.js')
const { functionAction, functionInfo, functionList } = require('./modules/functions.js')
const { config: {
  useAzureOpenai,
  DEFAULT_MODEL, AZURE_CHAT_MODEL,
  ADMIN_NAME, AI_NAME,
  systemPrompt
} } = require('./utils/loadConfig.js')

const logFile = fs.createWriteStream(path.join(LOG_PATH, `log-${new Date().toLocaleString('zh-CN').replace(/[\/:]/gi, '-')}.txt`), { flags: 'w' })
const messageLog = (message) => {
  logFile.write(format(new Date().toLocaleString('zh-CN'), JSON.stringify(message)) + '\n')
}
const messageSend = (message) => {
  mainWindow.webContents.send('send-message', message)
}
const messageLogAndSend = (message) => {
  messageLog(message)
  messageSend(message)
}

let errorlogFile = fs.createWriteStream(path.join(LOG_PATH, 'error_log.txt'), { flags: 'w' })
process
  .on('unhandledRejection', (reason, promise) => {
    errorlogFile.write(format('Unhandled Rejection at:', promise, 'reason:', reason) + '\n')
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  })
  .on('uncaughtException', err => {
    errorlogFile.write(format(err, 'Uncaught Exception thrown') + '\n')
    console.error(err, 'Uncaught Exception thrown')
    process.exit(1)
  })

let memoryTable

const STATUS = {
  isSpeechTalk: false,
  isAudioPlay: false,
  recordStatus: 'Recording',
  speakIndex: 0,
}

let speakTextList = []

let mainWindow
const createWindow = () => {
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
  win.setAutoHideMenuBar(true)
  const template = [
    {
      label: 'File',
      submenu: [
        {
          role: 'quit',
          accelerator: 'CommandOrControl+Q'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        {
          role: 'toggleDevTools',
          accelerator: 'F12',
          visible: false
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        {
          role: 'zoomIn',
          accelerator: 'CommandOrControl+=',
          visible: false
        },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  let menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  win.webContents.on('did-finish-load', () => {
    let name = require('./package.json').name
    let version = require('./package.json').version
    win.setTitle(name + ' ' + version)
  })
  win.once('ready-to-show', () => {
    win.show()
  })
  return win
}

const useOpenaiEmbeddingFunction = useAzureOpenai ? azureOpenaiEmbedding : openaiEmbedding
app.whenReady()
  .then(async () => {
    const memorydb = await lancedb.connect(path.join(STORE_PATH, 'memorydb'))
    const embedding = {
      sourceColumn: 'text',
      embed: async (batch) => {
        let result = []
        for (let text of batch) {
          result.push(await useOpenaiEmbeddingFunction({ input: text }))
        }
        return result
      }
    }
    try {
      memoryTable = await memorydb.openTable('memory', embedding)
    } catch {
      try {
        memoryTable = await memorydb.createTable('memory', [{ 'text': 'Hello world!' }], embedding)
      } catch { }
    }
    mainWindow = createWindow()
    setInterval(() => mainWindow.webContents.send('send-status', STATUS), 1000)
  })

app.on('window-all-closed', () => {
  app.quit()
})

/**
 * Executes text-to-speech and plays audio prompts.
 *
 * @param {Object} options - The options object.
 * @param {string} options.text - The text to be converted to speech.
 * @param {string} options.preAudioPath - The path to the pre-recorded audio prompt.
 * @return {Promise} A promise that resolves when the audio prompts have been played successfully.
 */
const speakPrompt = async ({ text, preAudioPath }) => {
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
      resolveSpeakTextList()
    }
  } catch (e) {
    console.log(e)
    resolveSpeakTextList()
  }
}

/**
 * Resolves the speak text list by sorting it based on the speak index. If a preAudioPath is provided, it will
 * get the first speak text from the list and call the speakPrompt function with the text and the preAudioPath.
 * If the list is empty after shifting the first element, it will call the speakPrompt function with only the preAudioPath.
 * If no preAudioPath is provided, it will get the first speak text from the list and call the speakPrompt function with the text.
 * If the list is empty after shifting the first element, it will wait for 1000 milliseconds and then call itself again.
 *
 * @param {string} preAudioPath - The path to the pre-recorded audio file.
 * @return {undefined}
 */
const resolveSpeakTextList = async (preAudioPath) => {
  speakTextList = _.sortBy(speakTextList, 'speakIndex')
  if (preAudioPath) {
    if (speakTextList.length > 0) {
      let { text, triggerRecord } = speakTextList.shift()
      if (triggerRecord) {
        await sound.play(preAudioPath)
        triggerSpeech()
        setTimeout(resolveSpeakTextList, 1000)
      } else {
        speakPrompt({ text, preAudioPath })
      }
    } else {
      speakPrompt({ preAudioPath })
    }
  } else if (speakTextList.length > 0) {
    let { text, triggerRecord } = speakTextList.shift()
    if (triggerRecord) {
      triggerSpeech()
      setTimeout(resolveSpeakTextList, 1000)
    } else {
      speakPrompt({ text })
    }
  } else {
    setTimeout(resolveSpeakTextList, 1000)
  }
}

resolveSpeakTextList()

const addHistory = (lines) => {
  let history = getStore('history')
  history.push(...lines)
  history = _.takeRight(history, 50)
  setStore('history', history)
}

const useOpenaiChatStreamFunction = useAzureOpenai ? azureOpenaiChatStream : openaiChatStream
const resolveMessages = async ({ resArgument, resFunction, resText, resTextTemp, messages, from}) => {

  console.log(`use ${useAzureOpenai ? AZURE_CHAT_MODEL : DEFAULT_MODEL}`)

  let clientMessageId = nanoid()
  let speakIndex = STATUS.speakIndex
  STATUS.speakIndex += 1

  if (!resText && resFunction && resArgument) {
    let functionCallResult
    try {
      messageLogAndSend({
        id: nanoid(),
        from,
        text: functionAction[resFunction](JSON.parse(resArgument))
      })
      switch (resFunction) {
        case 'getHistoricalConversationContent':
          functionCallResult = await functionList[resFunction](_.assign({ dbTable: memoryTable }, JSON.parse(resArgument)))
          break
        default:
          functionCallResult = await functionList[resFunction](JSON.parse(resArgument))
          break
      }
    } catch (e) {
      console.log(e)
      functionCallResult = ''
    }
    let functionCalling = [
      { role: "assistant", content: null, function_call: { name: resFunction, arguments: resArgument } },
      { role: "function", name: resFunction, content: functionCallResult + '' }
    ]
    messages.push(...functionCalling)
    addHistory(functionCalling)
    console.log(functionCalling)
  }
  resFunction = ''
  resArgument = ''

  for await (const { token, f_token } of useOpenaiChatStreamFunction({
    messages,
    functions: functionInfo,
    function_call: 'auto'
  })) {
    if (token) {
      resTextTemp += token
      resText += token
      messageSend({
        id: clientMessageId,
        from,
        text: resText
      })
      if (STATUS.isAudioPlay) {
        if (resTextTemp.includes('\n')) {
          let splitResText = resTextTemp.split('\n')
          splitResText = _.compact(splitResText)
          if (splitResText.length > 1) {
            resTextTemp = splitResText.pop()
          } else {
            resTextTemp = ''
          }
          let speakText = splitResText.join('\n').replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
          speakTextList.push({
            text: speakText,
            speakIndex,
          })
        }
      }
    }
    let { name, arguments: arg } = f_token
    if (name) resFunction = name
    if (arg) resArgument += arg
  }

  if (STATUS.isAudioPlay) {
    if (resTextTemp) {
      let speakText = resTextTemp.replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
      speakTextList.push({
        text: speakText,
        speakIndex,
      })
    }
  }

  return {
    messages,
    resFunction,
    resArgument,
    resTextTemp,
    resText
  }
}

/**
 * Asynchronously resolves an admin prompt by generating a response based on a given prompt and trigger record.
 *
 * @param {Object} options - An object containing the prompt and trigger record.
 * @param {string} options.prompt - The user prompt.
 * @param {Object} options.triggerRecord - The trigger record object.
 * @return {Promise<void>} - A promise that resolves with the generated response.
 */
const resloveAdminPrompt = async ({ prompt, triggerRecord }) => {
  let from = triggerRecord ? `(${AI_NAME})` : AI_NAME
  let history = getStore('history')
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `我的名字是${ADMIN_NAME}` },
    { role: 'assistant', content: `你好, ${ADMIN_NAME}` },
    ..._.takeRight(history, 12),
    { role: 'user', content: prompt }
  ]
  addHistory([{ role: 'user', content: prompt }])

  messageLog({
    id: nanoid(),
    from: triggerRecord ? `(${ADMIN_NAME})` : ADMIN_NAME,
    text: prompt
  })

  let resTextTemp = ''
  let resText = ''
  let resFunction
  let resArgument = ''

  try {
    while (resText === '') {
      ;({ messages, resArgument, resFunction, resText, resTextTemp } = await resolveMessages({
        resArgument, resFunction, resText, resTextTemp, messages, from
      }))
    }
    messageLog({
      id: nanoid(),
      from,
      text: resText
    })
    addHistory([{ role: 'assistant', content: resText }])
    memoryTable.add([{ text: resText }])
    if (triggerRecord) {
      let speakIndex = STATUS.speakIndex
      STATUS.isSpeechTalk += 1
      speakTextList.push({
        triggerRecord: true,
        speakIndex
      })
    }
  } catch (e) {
    console.log(e)
    if (triggerRecord && STATUS.isSpeechTalk) triggerSpeech()
  }
}


/**
 * Trigger speech function that listens for admin prompts and handles them accordingly.
 *
 * @return {Promise<void>} Returns a promise that resolves when the function is complete.
 */
const triggerSpeech = async () => {
  if (STATUS.isSpeechTalk) {
    STATUS.recordStatus = 'Recording'
    mainWindow.setProgressBar(100, { mode: 'indeterminate' })
    let adminTalk = await getSpeechText(STATUS)
    console.log(adminTalk)
    STATUS.recordStatus = 'Answering'
    mainWindow.setProgressBar(-1)
    messageLogAndSend({
      id: nanoid(),
      from: `(${ADMIN_NAME})`,
      text: adminTalk
    })
    resloveAdminPrompt({ prompt: adminTalk, triggerRecord: true })
  }
}

ipcMain.handle('send-prompt', async (event, text) => {
  resloveAdminPrompt({ prompt: text })
})
ipcMain.handle('get-admin-name', async (event) => {
  return ADMIN_NAME
})
ipcMain.handle('open-config', async (event) => {
  shell.openExternal(path.join(STORE_PATH, 'config.json'))
})
ipcMain.handle('switch-speech-talk', async () => {
  STATUS.isSpeechTalk = !STATUS.isSpeechTalk
  STATUS.isAudioPlay = STATUS.isSpeechTalk
  mainWindow.setProgressBar(-1)
  if (STATUS.isSpeechTalk) {
    triggerSpeech()
  }
})
ipcMain.handle('switch-audio', async () => {
  STATUS.isAudioPlay = !STATUS.isAudioPlay
})
ipcMain.handle('empty-history', async()=>{
  setStore('history', [])
})