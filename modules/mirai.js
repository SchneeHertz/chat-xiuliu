const WebSocket = require('ws')

const connectWs = async (verifyKey) => {
  const wss = new WebSocket(`ws://localhost:8080/message?verifyKey=${verifyKey}`)
  return new Promise((resolve) => {
    wss.on('open', ()=>{
      resolve(wss)
    })
  })
}

module.exports = {
  connectWs
}