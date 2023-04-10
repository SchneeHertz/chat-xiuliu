const { spawn } = require('node:child_process')

let ttsPromise = (text, audioPath, SpeechSynthesisVoiceName = 'zh-CN-XiaoyiNeural')=>{
  let vttPath = audioPath + '.vtt'
  return new Promise((resolve, reject)=>{
    const spawned = spawn('edge-tts', [
      '-v', SpeechSynthesisVoiceName, '--text', text, '--write-media', audioPath, '--write-subtitles', vttPath
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