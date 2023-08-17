const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { recordPromise } = require('./record.js')

const whisper = path.join(process.cwd(), 'resources/extraResources/whisper-faster.exe')

const getSpeechAudioJSON = (audioFilePath)=>{
  return new Promise((resolve, reject)=>{
    const spawned = spawn(whisper, [
      audioFilePath,
      '--model=large',
      '--output_format=json',
      `--output_dir=${path.dirname(audioFilePath)}`,
      '--beep=false',
      '--language=Chinese',
      '--initial_prompt=以下是普通话的句子。'
    ])
    spawned.on('error', data=>{
      reject(data)
    })
    spawned.on('exit', code=>{
      if (code === 0) {
        return resolve()
      }
      return reject('close code is ' + code)
    })
  })
}

const changeExtension = (filePath, extension)=>{
  const basename = path.basename(filePath, path.extname(filePath))
  return path.join(path.dirname(filePath), basename + extension)
}

const getSpeechText = async ()=>{
  let audioFilePath = await recordPromise()
  let jsonFilePath = changeExtension(audioFilePath, '.json')
  await getSpeechAudioJSON(audioFilePath)
  let resp = JSON.parse(fs.readFileSync(jsonFilePath, {encoding: 'utf-8'}))
  return resp.segments.map(s=>s.text).join('')
}

module.exports = {
  getSpeechText
}