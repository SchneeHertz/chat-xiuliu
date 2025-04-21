const { BrowserWindow, app, ipcMain, shell, Menu, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { format } = require('node:util')
const { pathToFileURL } = require('node:url')
const { nanoid } = require('nanoid')
const sound = require('sound-play')
const _ = require('lodash')
const windowStateKeeper = require('electron-window-state')
const { EdgeTTS } = require('node-edge-tts')

const { STORE_PATH, LOG_PATH, AUDIO_PATH } = require('./utils/initFile.js')
const { getRootPath } = require('./utils/fileTool.js')
const { getStore, setStore } = require('./modules/store.js')
const { getSpeechText } = require('./modules/whisper.js')
const { getTokenLength } = require('./modules/tiktoken.js')
const { openaiChat, openaiChatStream, openaiEmbedding, azureOpenaiChat, azureOpenaiChatStream, azureOpenaiEmbedding } = require('./modules/common.js')
const { functionAction, functionInfo, functionList } = require('./modules/functions.js')
const { addText, cosineSimilarity } = require('./modules/vectorDb.js')
const { config } = require('./utils/loadConfig.js')
const {
  useAzureOpenai,
  DEFAULT_MODEL, AZURE_CHAT_MODEL,
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
} = config
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

let pdfjsLib
;(async () => {
  const pdfjsDistUrl = pathToFileURL(path.join(getRootPath(), 'resources/extraResources/pdfjs-4.2.67-legacy-dist/build/pdf.mjs'))
  pdfjsLib = await import(pdfjsDistUrl)
})()

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

const STATUS = {
  isSpeechTalk: false,
  isAudioPlay: false,
  recordStatus: 'Recording',
  speakIndex: 0,
  answeringId: null,
  breakAnswerId: null,
  isLiving: false
}

const { prepareMint } = require('./modules/sensitive-word.js')
const mint = prepareMint()

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

  const currentArchiveId = getStore('current_archive_id')
  if (currentArchiveId) {
    const archives = getStore('history_archives') || []
    const archive = archives.find(a => a.id === currentArchiveId)

    if (archive) {
      setStore('history', archive.history)
    }
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
  let history = getStore('history') || []
  history.push(...lines)
  history = _.takeRight(history, 1000)
  setStore('history', history)
}

const useOpenaiChatStreamFunction = useAzureOpenai ? azureOpenaiChatStream : openaiChatStream
const useOpenaiChatFunction = useAzureOpenai ? azureOpenaiChat : openaiChat
const additionalParam = {
  searchResultLimit,
  webPageContentTokenLengthLimit
}
const resolveMessages = async ({ resToolCalls, resText, resTextTemp, messages, from, useFunctionCalling = false, clientMessageId, model }) => {

  console.log(`use ${useAzureOpenai ? 'azure ' + AZURE_CHAT_MODEL : 'openai ' + DEFAULT_MODEL}`)

  STATUS.answeringId = clientMessageId
  let speakIndex = STATUS.speakIndex
  STATUS.speakIndex += 1

  if (!_.isEmpty(resToolCalls)) {
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
        functionCallResult = await functionList[toolCall.function.name](JSON.parse(toolCall.function.arguments), additionalParam)
      } catch (e) {
        console.error(e)
        functionCallResult = e.message
      }
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: functionCallResult + '' })
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

  let resTextReason = ''
  const reasonMessageId = nanoid()

  let _usage = {}

  try {
    for await (const { token, r_token, f_token, usage } of useOpenaiChatStreamFunction(prepareChatOption)) {
      if (token) {
        resTextTemp += token
        resText += token
        messageSend({
          id: clientMessageId,
          from,
          content: resText,
          allowBreak: STATUS.breakAnswerId !== clientMessageId
        })
        if (resTextTemp.includes('\n')) {
          let splitResText = resTextTemp.split('\n')
          splitResText = _.compact(splitResText)
          if (splitResText.length > 1) {
            resTextTemp = splitResText.pop()
          } else {
            resTextTemp = ''
          }
          if (STATUS.isAudioPlay) {
            let speakText = splitResText.join('\n').replace(/[^a-zA-Z0-9一-龟]+[喵嘻捏][^a-zA-Z0-9一-龟]*$/, '喵~')
            speakTextList.push({
              text: speakText,
              speakIndex,
            })
          }
          if (STATUS.breakAnswerId === clientMessageId) {
            STATUS.breakAnswerId = null
            break
          }
        }
      }
      if (r_token) {
        resTextReason += r_token
        messageSend({
          id: clientMessageId,
          from,
          action: 'revoke'
        })
        messageSend({
          id: reasonMessageId,
          from: 'CoT',
          content: resTextReason
        })
      }
      if (!_.isEmpty(f_token)) {
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
      if (!_.isEmpty(usage)) {
        _usage = usage
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
  STATUS.answeringId = null
  return {
    messages,
    resToolCalls,
    resTextTemp,
    resText,
    usage: _usage
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
const resloveAdminPrompt = async ({ prompt, promptType = 'string', triggerRecord, givenSystemPrompt, useFullPDF }) => {
  let from = triggerRecord ? `(${AI_NAME})` : AI_NAME
  let history = getStore('history') || []
  let context = _.takeRight(history, historyRoundLimit)

  let fullSystemPrompt = givenSystemPrompt ? givenSystemPrompt : systemPrompt
  if (contextFileName && fileContext.length > 0) {
    let contextText
    if (useFullPDF) {
      contextText = fileContext.map(chunk => chunk.text).join('\n')
    } else {
      let promptText = Array.isArray(prompt) ? prompt.filter(part => part.type === 'text').map(part => part.text).join('\n') : prompt
      let closestChunks = findClosestEmbeddedChunks(await useOpenaiEmbeddingFunction({ input: promptText }), fileContext)
      contextText = closestChunks.map(chunk => chunk.text).join('\n')
    }
    fullSystemPrompt = `${fullSystemPrompt}\n\nContext: \n\n${contextText}`
  }

  let messages = [
    { role: 'system', content: fullSystemPrompt },
    // { role: 'user', content: `Hello, my name is ${ADMIN_NAME}` },
    // { role: 'assistant', content: `Hello, ${ADMIN_NAME}` },
    ...context,
    { role: 'user', content: prompt }
  ]

  messageLog({
    id: nanoid(),
    from: triggerRecord ? `(${ADMIN_NAME})` : ADMIN_NAME,
    content: prompt
  })

  let resTextTemp = ''
  let resText = ''
  let resToolCalls = []
  let useFunctionCalling = config.enableFunctionCalling
  try {
    let round = 0
    while (resText === '' && round <= functionCallingRoundLimit + 1) {
      let usage = {}
      if (useFunctionCalling) useFunctionCalling = round > functionCallingRoundLimit ? false : true
      if (!useFunctionCalling) console.log('Reached the functionCallingRoundlimit')
      const clientMessageId = nanoid()
      ;({ messages, resToolCalls, resText, resTextTemp, usage } = await resolveMessages({
        resToolCalls, resText, resTextTemp, messages, from, useFunctionCalling, clientMessageId
      }))
      round += 1
      if (!_.isEmpty(resToolCalls)) {
        messageLogAndSend({
          id: nanoid(),
          from,
          countToken: true,
          tokenCount: usage.total_tokens,
          content: 'use Function Calling'
        })
        messages.push({ role: 'assistant', content: null, tool_calls: resToolCalls })
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
          countToken: true,
          tokenCount: usage.total_tokens,
          content: resText,
          allowBreak: false,
          useContext: contextFileName,
          allowSave: true
        })
      }
    }
    messageLog({
      id: nanoid(),
      from,
      content: resText
    })
    addHistory([{ role: 'user', content: prompt }])
    addHistory([{ role: 'assistant', content: resText }])
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
  let history = getStore('history') || []
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
          content: text,
          allowSave: true
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

const breakAnswer = () => {
  if (STATUS.answeringId) {
    STATUS.breakAnswerId = STATUS.answeringId
    messageSend({
      id: STATUS.answeringId,
      allowBreak: false
    })
  }
}
ipcMain.handle('send-prompt', async (event, prompt) => {
  if (STATUS.isLiving) {
    processLive.addToQueue({ prompt: prompt.content })
    return
  }
  breakAnswer()
  await resloveAdminPrompt({
    prompt: prompt.content,
    promptType: prompt.type,
    useFullPDF: prompt.useFullPDF,
  })
})
ipcMain.handle('break-answer', async () => {
  breakAnswer()
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
ipcMain.handle('save-message', async (event, message) => {
  const saveMessage = getStore('saveMessage') || []
  saveMessage.push(...message)
  setStore('saveMessage', saveMessage)
})
ipcMain.handle('load-saved-message', async () => {
  return getStore('saveMessage') || []
})
ipcMain.handle('delete-saved-message', async (event, messageIds) => {
  let saveMessage = getStore('saveMessage') || []
  saveMessage = saveMessage.filter(item => !messageIds.includes(item.id))
  setStore('saveMessage', saveMessage)
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

ipcMain.handle('select-file', async (event, { filters } = {}) => {
  let result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters
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

// live mode

/**
 * 异步处理器，用于管理一个队列并按序处理，每隔一段时间检查队列并处理空队列情况
 */
class AsyncProcessor {
  /**
   * 创建一个异步处理器
   * @param {Function} asyncFunction - 异步处理函数
   * @param {number} waitTime - 等待时间(毫秒)
   */
  constructor(asyncFunction, waitTime = 30000) {
    this.queue = []
    this.asyncFunction = asyncFunction
    this.waitTime = waitTime
    this.processing = true
  }

  async startProcessing() {
    while (this.processing) {
      while (this.queue.length > 0) {
        const item = this.queue.shift()
        await this.asyncFunction(item)
      }

      await this.delayOrCheckQueue(this.waitTime)
    }
  }

  stopProcessing() {
    this.processing = false
  }

  async delayOrCheckQueue(ms) {
    const checkInterval = 1000
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (this.queue.length > 0) {
        return
      }
      await this.delay(checkInterval)
    }
    await this.asyncFunction()
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  addToQueue(item) {
    this.queue.push(item)
  }
}

let processLive

ipcMain.handle('switch-live', async () => {
  STATUS.isLiving = !STATUS.isLiving
  if (STATUS.isLiving) {
    const liveState = getStore('liveState') || {}
    if (_.isEmpty(liveState)) {
      const init = await fs.promises.readFile(path.join(__dirname, 'live/liveStateDemo.json'), { encoding: 'utf-8' })
      setStore('liveState', JSON.parse(init))
    }
    processLive = new AsyncProcessor(resolveLivePrompt)
    processLive.startProcessing()
  } else {
    if (processLive) processLive.stopProcessing()
  }
})

const resolveLivePrompt = async ({ prompt } = {}) => {
  if (!STATUS.isLiving) return
  const { geneMessages } = require('./live/think-script.js')
  const { messages, liveState, response_format } = await geneMessages({ prompt })
  const from = AI_NAME

  console.log(`use ${useAzureOpenai ? 'azure ' + AZURE_CHAT_MODEL : 'openai ' + DEFAULT_MODEL}`)

  let clientMessageId = nanoid()
  STATUS.answeringId = clientMessageId
  let speakIndex = STATUS.speakIndex
  STATUS.speakIndex += 1

  // alert chat
  messageSend({
    id: clientMessageId,
    from,
    content: ''
  })

  const chatOption = {
    messages,
    response_format
  }

  let response
  let internetResult
  try {
    const responseMessage = await useOpenaiChatFunction(chatOption)
    console.log(responseMessage)

    if (responseMessage.refusal) {
      messageLogAndSend({
        id: clientMessageId,
        from,
        content: `Error:\n\n${responseMessage.refusal}`
      })
      STATUS.answeringId = null
      return
    }

    response = JSON.parse(responseMessage.content)

    if (response.thoughtPiece) {
      liveState.thoughtCloud.push(
        _.assign(
          {},
          response.thoughtPiece,
          { timestamp: new Date().toLocaleString('zh-CN') }
        )
      )
    }
    if (prompt) addHistory([{ role: 'user', content: prompt }])
    if (response.text) {
      liveState.conversationState.push({
        timestamp: new Date().toLocaleString('zh-CN'),
        speaker: AI_NAME,
        type: response.action,
        text: response.text
      })
      addHistory([{ role: 'assistant', content: `${response.action}: \n\n${response.text}\n\nthoughtPiece:\n\n${response?.thoughtPiece?.text}` }])
    }
    switch (response.action) {
      case 'thought':
        break
      case 'speaking':
        if (STATUS.isAudioPlay && response.text) {
          let speakText = mint.filter(response.text).text
          speakTextList.push({
            text: speakText,
            speakIndex,
          })
        }
        break
      case 'remember':
        if (response.text) {
          addText({
            timestamp: new Date().toLocaleString('zh-CN'),
            text: response.text
          }, 'live')
        }
        break
      case 'search':
        if (response.text) {
          internetResult = await functionList['get_information_from_google']({ query_string: response.text }, additionalParam)
          liveState.conversationState.push({
            timestamp: new Date().toLocaleString('zh-CN'),
            speaker: 'Browser',
            type: 'internet',
            text: internetResult
          })
        }
        break
      case 'view_web_page':
        if (response.text) {
          internetResult = await functionList['get_text_content_of_webpage']({ url: response.text }, additionalParam)
          liveState.conversationState.push({
            timestamp: new Date().toLocaleString('zh-CN'),
            speaker: 'Browser',
            type: 'internet',
            text: internetResult
          })
        }
        break
    }
    // limit the length of the conversationState and thoughtCloud
    liveState.conversationState = _.takeRight(liveState.conversationState, 24)
    liveState.thoughtCloud = _.takeRight(liveState.thoughtCloud, 42)
    setStore('liveState', liveState)
  } catch (error) {
    messageLogAndSend({
      id: clientMessageId,
      from,
      content: `Error:\n\n${error.message}`
    })
    STATUS.answeringId = null
    return
  }

  if (_.isEmpty(response.text)) {
    messageSend({
      id: clientMessageId,
      from,
      action: 'revoke'
    })
  } else {
    messageLogAndSend({
      id: clientMessageId,
      from,
      messages,
      countToken: true,
      content: `${response.action}: \n\n${response.text}\n\nthoughtPiece:\n\n${response?.thoughtPiece?.text}`,
      allowBreak: false,
      useContext: contextFileName,
      allowSave: true
    })
  }
  if (internetResult) {
    messageSend({
      id: nanoid(),
      from: 'Browser',
      content: internetResult
    })
  }
  STATUS.answeringId = null
  return
}

ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url)
})

let fileContext = []
let contextFileName

ipcMain.handle('resolve-pdf', async (event, pdfPath) => {

  contextFileName = path.basename(pdfPath)
  const clientMessageId = nanoid()
  messageSend({
    id: clientMessageId,
    from: AI_NAME,
    content: `正在读取和解析 ${contextFileName} ...`
  })

  //检查pdfPath + '.json'是否存在，如果存在则直接返回
  if (fs.existsSync(pdfPath + '.json')) {
    fileContext = JSON.parse(await fs.promises.readFile(pdfPath + '.json', { encoding: 'utf-8' }))
    messageSend({
      id: clientMessageId,
      from: AI_NAME,
      content: `已从缓存文件中读取 ${contextFileName} 的解析结果。`
    })
    return
  }

  const data = new Uint8Array(await fs.promises.readFile(pdfPath))
  const pdfDocument = await pdfjsLib.getDocument({ data }).promise

  let chunks = []
  let currentChunk = ''
  let currentTokenCount = 0
  const maxTokenLength = 1024

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    const textContent = await page.getTextContent()
    let lastY = -1

    for (const item of textContent.items) {
      const itemText = item.str
      const itemTokenLength = getTokenLength(itemText)

      // 检查是否需要添加换行符
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
        if (currentTokenCount + 1 > maxTokenLength) {
          chunks.push({ text: currentChunk, index: chunks.length })
          currentChunk = ''
          currentTokenCount = 0
        }
        currentChunk += '\n'
        currentTokenCount += 1 // 换行符也算作一个token
      }

      // 检查添加该文本项是否会超过限制
      if (currentTokenCount + itemTokenLength > maxTokenLength) {
        chunks.push({ text: currentChunk, index: chunks.length })
        currentChunk = itemText
        currentTokenCount = itemTokenLength
      } else {
        currentChunk += itemText
        currentTokenCount += itemTokenLength
      }

      lastY = item.transform[5]
    }

    // 每页之间添加额外的换行以分隔
    if (currentTokenCount + 2 <= maxTokenLength) {
      currentChunk += '\n\n'
      currentTokenCount += 2
    } else {
      chunks.push({ text: currentChunk, index: chunks.length })
      currentChunk = '\n\n'
      currentTokenCount = 2
    }
  }

  // 添加最后一块
  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk, index: chunks.length })
  }

  const chunkSize = 5
  const embeddedChunks = []

  for (let i = 0; i < chunks.length; i += chunkSize) {
    let batch = chunks.slice(i, i + chunkSize)
    let results = await Promise.allSettled(batch.map(chunk => useOpenaiEmbeddingFunction({ input: chunk.text })))

    // 处理结果，只收集成功的
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        embeddedChunks.push({ index: batch[index].index, text: batch[index].text, embedding: result.value })
      } else {
        console.error('Embedding failed for: ', batch[index])
        embeddedChunks.push({ index: batch[index].index, text: batch[index].text })
      }
    })
  }

  await fs.promises.writeFile(pdfPath + '.json', JSON.stringify(embeddedChunks, null, '  '), { encoding: 'utf-8' })

  fileContext = embeddedChunks

  messageSend({
    id: clientMessageId,
    from: AI_NAME,
    content: `已解析 ${contextFileName} 。`
  })
})

function findClosestEmbeddedChunks(newEmbedded, embeddedChunks) {

  // 为每个chunk计算与新嵌入向量的距离
  let similarities = embeddedChunks.map(chunk => ({
      chunk: chunk,
      similarity: cosineSimilarity(newEmbedded, chunk.embedding)
  }))

  // 按相似度降序排序，获取最相似的前两个
  similarities.sort((a, b) => b.similarity - a.similarity)

  // 只返回前三个最接近的chunks
  let closestChunks = similarities.slice(0, 3).map(item => item.chunk)

  // 按index属性对这些chunks进行升序排序
  closestChunks.sort((a, b) => a.index - b.index)

  return closestChunks
}

ipcMain.handle('remove-context', async (event) => {
  fileContext = []
  contextFileName = undefined
})

// 存档相关功能
ipcMain.handle('archive-history', async (event, name) => {
  const history = getStore('history') || []
  const archives = getStore('history_archives') || []

  const newArchive = {
    id: nanoid(),
    name,
    date: Date.now(),
    history: _.cloneDeep(history)
  }

  archives.push(newArchive)
  setStore('history_archives', archives)
  return newArchive.id
})

ipcMain.handle('get-history-archives', async () => {
  const archives = getStore('history_archives') || []
  return archives.map(archive => ({
    id: archive.id,
    name: archive.name,
    date: archive.date
  }))
})

ipcMain.handle('switch-to-archive', async (event, archiveId) => {
  const archives = getStore('history_archives') || []
  const archive = archives.find(a => a.id === archiveId)

  if (archive) {
    setStore('history', archive.history)
    return true
  }
  return false
})

ipcMain.handle('update-archive', async (event, archiveId, newName) => {
  const archives = getStore('history_archives') || []
  const archiveIndex = archives.findIndex(a => a.id === archiveId)

  if (archiveIndex !== -1) {
    const currentHistory = getStore('history') || []

    archives[archiveIndex] = {
      ...archives[archiveIndex],
      name: newName,
      date: Date.now(),
      history: _.cloneDeep(currentHistory)
    }

    setStore('history_archives', archives)
    return true
  }
  return false
})

ipcMain.handle('delete-archive', async (event, archiveId) => {
  const archives = getStore('history_archives') || []
  const newArchives = archives.filter(a => a.id !== archiveId)

  setStore('history_archives', newArchives)
  return true
})

ipcMain.handle('save-current-archive-id', async (event, archiveId) => {
  setStore('current_archive_id', archiveId)
  return true
})

ipcMain.handle('get-current-archive-id', async () => {
  return getStore('current_archive_id') || null
})