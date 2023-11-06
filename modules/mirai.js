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

// mirai connect
// const { connectWs } = require('./modules/mirai.js')
// if (miraiSetting.USE_MIRAI) {
//   connectWs(miraiSetting.VERIFY_KEY)
//   .then(wss=>{
//     let tempMessage = []
//     wss.addEventListener('message', async (event) => {
//       let messageObject = JSON.parse(event.data).data || {}
//       if (messageObject.type === 'GroupMessage') {
//         let message = `###${messageObject.sender.memberName}: `
//         let forceReply
//         let hasPlain = false
//         messageObject.messageChain.forEach(part => {
//           switch (part.type) {
//             case 'At':
//               if (part.target === miraiSetting.QQ) {
//                 forceReply = messageObject.sender.id
//               }
//               message += part.display + ' '
//               break
//             case 'Plain':
//               hasPlain = true
//               message += part.text
//               break
//           }
//         })
//         if (hasPlain) {
//           tempMessage.push(message + '###')
//           let prepareMessage = {
//             target: miraiSetting.QQ_GROUP_NUMBER,
//             messageChain:[]
//           }
//           if (forceReply) {
//             prepareMessage.messageChain.push({
//               type: 'At',
//               target: forceReply
//             })
//           }
//           if (forceReply || message.includes('休留') || Math.random() > 0.95) {
//             let prompt = `历史消息:\n ${_.initial(_.takeRight(tempMessage, 10)).join('\n')}\n当前消息:\n ${_.last(tempMessage)}`
//             messageLogAndSend({
//               id: nanoid(),
//               from: '群聊',
//               text: prompt
//             })
//             prepareMessage.messageChain.push({
//               type:'Plain',
//               text: await resloveAdminPrompt({ prompt, miraiSystemPrompt: `你是虚拟猫娘休留,你现在在聊天群里聊天,你需要遵守以下规则:\n1.群友会以###昵称: 内容###的形式发言\n2.记住你是在聊天,用高度口语化的表述发言,不要重复历史消息` })
//             })
//             tempMessage = []
//             wss.send(JSON.stringify({
//               syncId: -1,
//               command: 'sendGroupMessage',
//               subCommand: null,
//               content: prepareMessage
//             }))
//           }
//         }
//       }
//     })
//   })
// }

// setting
// miraiSetting: {
//   USE_MIRAI: false,
//   VERIFY_KEY: '',
//   QQ: 0,
//   QQ_GROUP_NUMBER: 0
// },