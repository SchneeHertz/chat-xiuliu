const { BrowserWindow, app, ipcMain, shell, Menu, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { nanoid } = require('nanoid')
const sound = require('sound-play')
const _ = require('lodash')
const lancedb = require('vectordb')
const windowStateKeeper = require('electron-window-state')
const { EdgeTTS } = require('node-edge-tts')

const { STORE_PATH, LOG_PATH, AUDIO_PATH } = require('./utils/initFile.js')
const { getStore, setStore } = require('./modules/store.js')
const { getSpeechText } = require('./modules/whisper.js')
const { getTokenLength } = require('./modules/tiktoken.js')
const { openaiChatStream, openaiEmbedding, azureOpenaiChatStream, azureOpenaiEmbedding } = require('./modules/common.js')
const { functionAction, functionInfo, functionList } = require('./modules/functions.js')
const { config } = require('./utils/loadConfig.js')
const {
  useAzureOpenai,
  DEFAULT_MODEL, AZURE_CHAT_MODEL, AZURE_VISION_MODEL,
  SpeechSynthesisVoiceName,
  ADMIN_NAME, AI_NAME,
  systemPrompt,
  useProxy,
  proxyObject,
  historyRoundLimit = 12,
  functionCallingRoundLimit = 3,
  disableFunctions = [],
  searchResultLimit = 5,
  webPageContentTokenLengthLimit = 6000,
  autoUseVisionModel = false,
} = config
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

const logFile = fs.createWriteStream(path.join(LOG_PATH, `log-${new Date().toLocaleString('zh-CN').replace(/[\/:]/gi, '-')}.txt`), { flags: 'w' })
const messageLog = (message) => {
  logFile.write(format(new Date().toLocaleString('zh-CN'), JSON.stringify(message)) + '\n')
}
const messageSend = (message) => {
  // The part of Vision is not accurately calculated in the token calculation.
  if (message.countToken) {
    let tokenCount = 0
    message.messages.forEach((item) => {
      switch (item.role) {
        case 'system':
        case 'tool':
          tokenCount += getTokenLength(item.content)
          break
        case 'assistant':
          tokenCount += getTokenLength(item.content || JSON.stringify(item.tool_calls))
          break
        case 'user':
          if (typeof item.content === 'string') {
            tokenCount += getTokenLength(item.content)
          } else {
            item.content.forEach((content) => {
              switch (content.type) {
                case 'text':
                  tokenCount += getTokenLength(content.text)
                  break
                case 'image_url':
                  tokenCount += 85
                  break
              }
            })
          }
          break
      }
    })
    tokenCount += getTokenLength(message.content)
    message.tokenCount = tokenCount
  }
  mainWindow.webContents.send('send-message', _.omit(message, 'messages'))
}
const messageLogAndSend = (message) => {
  messageLog(message)
  messageSend(message)
}

let errorlogFile = fs.createWriteStream(path.join(LOG_PATH, 'error_log.txt'), { flags: 'w' })
console.error = (...message)=>{
  errorlogFile.write('\n' + format(new Date().toLocaleString()) + '\n')
  errorlogFile.write(format(...message) + '\n')
  process.stderr.write(format(...message) + '\n')
}
process
  .on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  })
  .on('uncaughtException', err => {
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
let tts = new EdgeTTS({
  voice: SpeechSynthesisVoiceName,
  lang: 'zh-CN',
  outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  proxy: useProxy ? proxyString : undefined,
  saveSubtitles: true
})

let mainWindow
const createWindow = () => {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 720
  })
  const win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      webSecurity: app.isPackaged ? true : false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  })
  mainWindowState.manage(win)
  if (app.isPackaged) {
    win.loadFile('dist/index.html')
  } else {
    win.loadURL('http://localhost:5174')
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
    win.setTitle(app.getName() + ' ' + app.getVersion())
  })
  win.once('ready-to-show', () => {
    win.show()
  })
  return win
}

const useOpenaiEmbeddingFunction = useAzureOpenai ? azureOpenaiEmbedding : openaiEmbedding
app.whenReady().then(async () => {
  mainWindow = createWindow()
  setInterval(() => mainWindow.webContents.send('send-status', STATUS), 1000)
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
      memoryTable = await memorydb.createTable('memory', [{ text: 'Hello world!' }], embedding)
    } catch { }
  }
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
          tts.ttsPromise(text, nextAudioPath),
          sound.play(preAudioPath)
        ])
      } else {
        await tts.ttsPromise(text, nextAudioPath)
      }
      resolveSpeakTextList(nextAudioPath)
    } else if (preAudioPath) {
      await sound.play(preAudioPath)
      resolveSpeakTextList()
    }
  } catch (e) {
    console.error(e)
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
  history = _.takeRight(history, 1000)
  setStore('history', history)
}

const useOpenaiChatStreamFunction = useAzureOpenai ? azureOpenaiChatStream : openaiChatStream
const additionalParam = {
  searchResultLimit,
  webPageContentTokenLengthLimit
}
const resolveMessages = async ({ resToolCalls, resText, resTextTemp, messages, from, useFunctionCalling = false, model }) => {

  console.log(`use ${useAzureOpenai ? 'azure ' + AZURE_CHAT_MODEL : 'openai ' + DEFAULT_MODEL}`)

  let clientMessageId = nanoid()
  let speakIndex = STATUS.speakIndex
  STATUS.speakIndex += 1

  if (!_.isEmpty(resToolCalls)) {
    messageLogAndSend({
      id: nanoid(),
      from,
      messages,
      countToken: true,
      content: 'use Function Calling'
    })
    messages.push({ role: 'assistant', content: null, tool_calls: resToolCalls })
    // addHistory([{ role: 'assistant', content: null, tool_calls: resToolCalls }])
    for (let toolCall of resToolCalls) {
      let functionCallResult
      let functionCallResultMessageId = nanoid()
      try {
        messageLogAndSend({
          id: nanoid(),
          from,
          content: functionAction[toolCall.function.name](JSON.parse(toolCall.function.arguments))
        })
        messageLogAndSend({
          id: functionCallResultMessageId,
          from: 'Function Calling',
          content: ''
        })
        switch (toolCall.function.name) {
          case 'getHistoricalConversationContent':
            functionCallResult = await functionList[toolCall.function.name](_.assign({ dbTable: memoryTable }, JSON.parse(toolCall.function.arguments)), additionalParam)
            break
          default:
            functionCallResult = await functionList[toolCall.function.name](JSON.parse(toolCall.function.arguments), additionalParam)
            break
        }
      } catch (e) {
        console.error(e)
        functionCallResult = e.message
      }
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: functionCallResult + '' })
      // addHistory([{ role: 'tool', tool_call_id: toolCall.id, content: functionCallResult + '' }])
      messageLogAndSend({
        id: functionCallResultMessageId,
        from: 'Function Calling',
        content: functionCallResult + ''
      })
    }
  }
  resToolCalls = []

  let prepareChatOption = { messages, model }

  if (useFunctionCalling) {
    prepareChatOption.tools = functionInfo.filter(f => !disableFunctions.includes(f?.function?.name))
    if (!_.isEmpty(prepareChatOption.tools)) prepareChatOption.tool_choice = 'auto'
  }

  // alert chat
  messageSend({
    id: clientMessageId,
    from,
    content: ''
  })

  try {
    for await (const { token, f_token } of useOpenaiChatStreamFunction(prepareChatOption)) {
      if (token) {
        resTextTemp += token
        resText += token
        messageSend({
          id: clientMessageId,
          from,
          content: resText
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
      let [{ index, id, type, function: { name, arguments: arg} } = { function: {} }] = f_token
      if (index !== undefined ) {
        if (resToolCalls[index]) {
          if (id) resToolCalls[index].id = id
          if (type) resToolCalls[index].type = type
          if (name) resToolCalls[index].function.name = name
          if (arg) resToolCalls[index].function.arguments += arg
        } else {
          resToolCalls[index] = {
            id, type, function: { name, arguments: arg }
          }
        }
      }
    }
  } catch (error) {
    messageSend({
      id: clientMessageId,
      from,
      content: `Error: ${error.message}`
    })
    throw error
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
  if (_.isEmpty(resText)) {
    messageSend({
      id: clientMessageId,
      from,
      action: 'revoke'
    })
  } else {
    messageSend({
      id: clientMessageId,
      from,
      messages,
      countToken: true,
      content: resText
    })
  }

  return {
    messages,
    resToolCalls,
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
const resloveAdminPrompt = async ({ prompt, promptType = 'string', triggerRecord, givenSystemPrompt }) => {
  let from = triggerRecord ? `(${AI_NAME})` : AI_NAME
  let history = getStore('history')
  let context = _.takeRight(history, historyRoundLimit)
  context.forEach(line => {
    if (line.role === 'user' && typeof line.content === 'object') {
      line.content = line.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
    }
  })
  let messages = [
    { role: 'system', content: givenSystemPrompt ? givenSystemPrompt : systemPrompt },
    { role: 'user', content: `你好, 我的名字是${ADMIN_NAME}` },
    { role: 'assistant', content: `你好, ${ADMIN_NAME}` },
    ...context,
    { role: 'user', content: prompt }
  ]
  addHistory([{ role: 'user', content: prompt }])

  messageLog({
    id: nanoid(),
    from: triggerRecord ? `(${ADMIN_NAME})` : ADMIN_NAME,
    content: prompt
  })

  let resTextTemp = ''
  let resText = ''
  let resToolCalls = []

  try {
    if (promptType === 'string') {
      let round = 0
      while (resText === '' && round <= functionCallingRoundLimit + 1) {
        let useFunctionCalling = round > functionCallingRoundLimit ? false : true
        if (!useFunctionCalling) console.log('Reached the functionCallingRoundlimit')
        ;({ messages, resToolCalls, resText, resTextTemp } = await resolveMessages({
          resToolCalls, resText, resTextTemp, messages, from, useFunctionCalling
        }))
        round += 1
      }
    } else {
      if (autoUseVisionModel) {
        let model = useAzureOpenai ? AZURE_VISION_MODEL : 'gpt-4-vision-preview'
        resText = (await resolveMessages({ resText, messages, from, model })).resText
      } else {
        resText = (await resolveMessages({ resText, messages, from })).resText
      }
    }
    messageLog({
      id: nanoid(),
      from,
      content: resText
    })
    addHistory([{ role: 'assistant', content: resText }])
    memoryTable.add([{ text: resText }])
    if (triggerRecord) {
      let speakIndex = STATUS.speakIndex
      STATUS.speakIndex += 1
      speakTextList.push({
        triggerRecord: true,
        speakIndex
      })
    }
  } catch (e) {
    console.error(e)
    if (triggerRecord && STATUS.isSpeechTalk) triggerSpeech()
  }
  return resText
}

const sendHistory = (limit) => {
  let history = getStore('history')
  history = _.takeRight(history, limit)
  history.forEach((item) => {
    switch (item.role) {
      case 'user':
        messageSend({
          id: nanoid(),
          from: ADMIN_NAME,
          content: item.content
        })
        break
      case 'assistant':
        let text = ''
        try {
          if (item.content !== null) {
            text = item.content
          } else {
            text = item.tool_calls.map( item => {
              return functionAction[item.function.name](JSON.parse(item.function.arguments))
            }).join('\n')
          }
        } catch {}
        messageSend({
          id: nanoid(),
          from: AI_NAME,
          content: text
        })
        break
      case 'tool':
        messageSend({
          id: nanoid(),
          from: 'Function Calling',
          content: item.content
        })
        break
    }
  })
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
    if (!STATUS.isSpeechTalk) {
      throw new Error('Speech is not enabled now.')
    }
    STATUS.recordStatus = 'Answering'
    mainWindow.setProgressBar(-1)
    messageLogAndSend({
      id: nanoid(),
      from: `(${ADMIN_NAME})`,
      content: adminTalk
    })
    resloveAdminPrompt({ prompt: adminTalk, triggerRecord: true })
  }
}

ipcMain.handle('send-prompt', async (event, prompt) => {
  resloveAdminPrompt({
    prompt: prompt.content,
    promptType: prompt.type
  })
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
ipcMain.handle('empty-history', async () => {
  setStore('history', [])
})
ipcMain.handle('load-history', async() => {
  sendHistory(20)
})
ipcMain.handle('restart-app', async()=>{
  app.relaunch()
  app.exit(0)
})

// setting
ipcMain.handle('select-folder', async () => {
  let result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (!result.canceled) {
    return result.filePaths[0]
  } else {
    return undefined
  }
})

ipcMain.handle('select-file', async () => {
  let result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  })
  if (!result.canceled) {
    return result.filePaths[0]
  } else {
    return undefined
  }
})

ipcMain.handle('load-setting', async () => {
  return config
})

ipcMain.handle('save-setting', async (event, receiveSetting) => {
  return await fs.promises.writeFile(path.join(STORE_PATH, 'config.json'), JSON.stringify(receiveSetting, null, '  '), { encoding: 'utf-8' })
})

ipcMain.handle('get-function-info', async () => {
  return functionInfo
})

ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url)
})