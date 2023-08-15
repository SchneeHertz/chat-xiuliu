const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { nanoid } = require('nanoid')

const sox = path.join(process.cwd(), 'resources/extraResources/sox.exe')
let recordPromise = (SPEECH_AUDIO_PATH)=>{
  let audioFilePath = path.join(SPEECH_AUDIO_PATH, nanoid() + '.mp3')
  return new Promise((resolve, reject)=>{
    const spawned = spawn(sox, ['-d', '-t', 'mp3', audioFilePath, 'silence', '1', '0.1', '3%', '1', '3.0', '3%'])
    spawned.on('error', data=>{
      reject(data)
    })
    spawned.on('exit', code=>{
      if (code === 0) {
        return resolve(audioFilePath)
      }
      return reject('close code is ' + code)
    })
  })
}

let getSpeechText = async (openai, SPEECH_AUDIO_PATH, proxy)=>{
  let audioFilePath = await recordPromise(SPEECH_AUDIO_PATH)
  const resp = await openai.createTranscription(
    fs.createReadStream(audioFilePath),
    'whisper-1',
    undefined,undefined,undefined,undefined,
    { proxy }
  )
  return resp.data.text
}


module.exports = {
  getSpeechText
}