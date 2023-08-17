const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { recordPromise } = require('./record.js')

const whisper = path.join(process.cwd(), 'resources/extraResources/whisper/whisper-faster.exe')

const getSpeechAudioJSON = (audioFilePath)=>{
  return new Promise((resolve, reject)=>{
    const spawned = spawn(whisper, [
      audioFilePath,
      '-m', 'large',
      '--output_format', 'json',
      '--output_dir', path.dirname(audioFilePath),
      '--beep_off',
      '-l', 'Chinese',
      '-prompt', '以下是普通话的句子。'
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

/**
 * Retrieves the text from a speech audio file.
 *
 * @return {string} The text extracted from the speech audio file.
 */
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