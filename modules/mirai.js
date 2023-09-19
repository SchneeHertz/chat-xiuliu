const WS = require("ws");
const ReconnectingWebSocket = require("reconnecting-websocket")

const connectWs = async (verifyKey) => {
  const wss = new ReconnectingWebSocket(`ws://127.0.0.1:8080/message?verifyKey=${verifyKey}`, [], { WebSocket: WS })
  return new Promise((resolve) => {
    wss.addEventListener('open', ()=>{
      resolve(wss)
    })
  })
}

module.exports = {
  connectWs
}