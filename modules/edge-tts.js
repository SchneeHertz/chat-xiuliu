// const { spawn } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const fs = require('node:fs')
const { config: { SpeechSynthesisVoiceName, proxyString} } = require('../utils/loadConfig.js')
const { WebSocket } = require('ws')
const { HttpsProxyAgent } = require('https-proxy-agent')

// const ttsPromise = (text, audioPath) => {
//   let vttPath = audioPath + '.vtt'
//   return new Promise((resolve, reject) => {
//     const spawned = spawn('edge-tts', [
//       '-v', SpeechSynthesisVoiceName,
//       '--text', text,
//       '--write-media', audioPath,
//       '--write-subtitles', vttPath,
//       '--proxy', proxyString
//     ])
//     spawned.on('error', data => {
//       reject(data)
//     })
//     spawned.on('exit', code => {
//       if (code === 0) {
//         return resolve(vttPath)
//       }
//       return reject('edge-tts close code is ' + code)
//     })
//   })
// }

let wsConnect = {}
const connectWebSocket = async () => {
  const wsConnect = new WebSocket(`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`, {
    host: 'speech.platform.bing.com',
    origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44',
    },
    agent: new HttpsProxyAgent(proxyString)
  })
  await new Promise((resolve, reject) => {
    wsConnect.on('open', () => {
      wsConnect.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n
        {
          "context": {
            "synthesis": {
              "audio": {
                  "metadataoptions": {
                    "sentenceBoundaryEnabled": "false",
                    "wordBoundaryEnabled": "false"
                  },
                  "outputFormat": "audio-24khz-96kbitrate-mono-mp3"
              }
            }
          }
        }
      `)
      resolve()
    })
  })
  return wsConnect
}

const ttsPromise = async (text, audioPath) => {
  if (wsConnect.readyState !== 1) {
    wsConnect = await connectWebSocket()
  }
  return await new Promise((resolve, reject) => {
    let requestId = randomBytes(16).toString('hex')
    let queue = fs.createWriteStream(audioPath)
    wsConnect.on('message', async (message, isBinary) => {
      if (isBinary) {
        const separator = 'Path:audio\r\n'
        const index = message.indexOf(separator) + separator.length
        const audioData = message.slice(index, message.length)
        queue.write(audioData)
      } else {
        if (message.toString().includes('Path:turn.end')) {
          queue.end()
          resolve()
        }
      }
    })
    wsConnect.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n
    ` + `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
      <voice name="${SpeechSynthesisVoiceName}">
          ${text}
      </voice>
    </speak>`)
  })
}

module.exports = {
  ttsPromise
}