const { spawn } = require('node:child_process')
const { config } = require('../utils/loadConfig.js')

let ttsPromise = (text, audioPath)=>{
  let vttPath = audioPath + '.vtt'
  return new Promise((resolve, reject)=>{
    const spawned = spawn('edge-tts', [
      '-v', config.SpeechSynthesisVoiceName,
      '--text', text,
      '--write-media', audioPath,
      '--write-subtitles', vttPath,
      '--proxy', config.proxyString
    ])
    spawned.on('error', data=>{
      reject(data)
    })
    spawned.on('exit', code=>{
      if (code === 0) {
        return resolve(vttPath)
      }
      return reject('close code is ' + code)
    })
  })
}

module.exports = {
  ttsPromise
}