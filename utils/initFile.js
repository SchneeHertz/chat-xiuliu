const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = app.getPath('userData')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

const LOG_PATH = path.join(STORE_PATH, 'log')
const AUDIO_PATH = path.join(STORE_PATH, 'audio')
const SPEECH_AUDIO_PATH = path.join(STORE_PATH, 'speechAudio')

try {
  fs.rmSync(AUDIO_PATH, {recursive: true, force: true})
  fs.rmSync(SPEECH_AUDIO_PATH, {recursive: true, force: true})
} catch {}

fs.mkdir(LOG_PATH, {recursive: true}, (err) => {
  if (err) throw err
})
fs.mkdir(AUDIO_PATH, {recursive: true}, (err) => {
  if (err) throw err
})
fs.mkdir(SPEECH_AUDIO_PATH, {recursive: true}, (err) => {
  if (err) throw err
})

let config
try {
  config = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'config.json'), {encoding: 'utf-8'}))
} catch {
  config = {
    OPENAI_API_KEY: '',
    USE_MODEL: 'gpt-3.5-turbo',
    SPEECH_KEY: '',
    SPEECH_AREA: 'eastasia',
    SpeechSynthesisLanguage: 'zh-CN',
    SpeechSynthesisVoiceName: 'zh-CN-XiaoyiNeural',
    ADMIN_NAME: 'Chell',
    AI_NAME: '休留',
    systemPrompt: '你是女高中生休留'
  }
  fs.writeFileSync(path.join(STORE_PATH, 'config.json'), JSON.stringify(config, null, '  '), {encoding: 'utf-8'})
}

let history
try {
  history = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'history.json'), {encoding: 'utf-8'}))
} catch {
  history = {
    memory: '-',
    limitHistory: {conversationLimit: 5, memoryLength: 500},
    useHistory: 0,
    conversationHistory: []
  }
  fs.writeFileSync(path.join(STORE_PATH, 'history.json'), JSON.stringify(history, null, '  '), {encoding: 'utf-8'})
}


module.exports = {
  config,
  history,
  STORE_PATH,
  LOG_PATH,
  AUDIO_PATH,
  SPEECH_AUDIO_PATH
}