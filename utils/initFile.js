const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

const LOG_PATH = path.join(STORE_PATH, 'log')
const AUDIO_PATH = path.join(STORE_PATH, 'audio')
const SPEECH_AUDIO_PATH = path.join(STORE_PATH, 'speechAudio')

try {
  fs.rmSync(AUDIO_PATH, { recursive: true, force: true })
  fs.rmSync(SPEECH_AUDIO_PATH, { recursive: true, force: true })
} catch { }

fs.mkdir(LOG_PATH, { recursive: true }, (err) => {
  if (err) throw err
})
fs.mkdir(AUDIO_PATH, { recursive: true }, (err) => {
  if (err) throw err
})
fs.mkdir(SPEECH_AUDIO_PATH, { recursive: true }, (err) => {
  if (err) throw err
})

module.exports = {
  STORE_PATH,
  LOG_PATH,
  AUDIO_PATH,
  SPEECH_AUDIO_PATH
}