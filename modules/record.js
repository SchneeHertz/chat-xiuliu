const { spawn } = require('node:child_process')
const path = require('node:path')
const { nanoid } = require('nanoid')

const { STORE_PATH, getRootPath } = require('../utils/fileTool.js')

const SPEECH_AUDIO_PATH = path.join(STORE_PATH, 'speechAudio')

const sox = path.join(getRootPath(), 'resources/extraResources/sox/sox.exe')
const recordPromise = () => {
  let audioFilePath = path.join(SPEECH_AUDIO_PATH, nanoid() + '.wav')
  return new Promise((resolve, reject) => {
    const spawned = spawn(sox, ['-d', '-t', 'waveaudio', 'default', audioFilePath, 'silence', '1', '0.1', '3%', '1', '3.0', '3%'])
    spawned.on('error', data => {
      reject(data)
    })
    spawned.on('exit', code => {
      if (code === 0) {
        return resolve(audioFilePath)
      }
      return reject('sox close code is ' + code)
    })
  })
}


module.exports = {
  recordPromise
}