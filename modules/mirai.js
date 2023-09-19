require('dotenv').config()
const WebSocket = require('ws')

const wss = new WebSocket(`ws://localhost:8080/message?verifyKey=${process.env.verifyKey}`)

const registerMessageHandle = (func) => {
  wss.on('message', func)
}

const sendMessage = (message) => {
  wss.send(JSON.stringify(message))
}

module.exports = {
  registerMessageHandle, sendMessage
}