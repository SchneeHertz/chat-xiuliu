const { spawn } = require('node:child_process')
const { config } = require('../utils/initFile.js')

const edgeTTS = path.join(process.cwd(), 'resources/extraResources/edge-tts.exe')

let ttsPromise = (text, audioPath, SpeechSynthesisVoiceName = 'zh-CN-XiaoyiNeural')=>{
  let vttPath = audioPath + '.vtt'
  return new Promise((resolve, reject)=>{
    const spawned = spawn(edgeTTS, [
      '-v', SpeechSynthesisVoiceName,
      '--text', text,
      '--write-media', audioPath,
      '--write-subtitles', vttPath,
      '--proxy', config.proxy
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