const { StringDecoder } = require('node:string_decoder')
const OpenAI = require('openai')
const { HttpsProxyAgent } = require('https-proxy-agent')
const axios = require('axios')
const _ = require('lodash')

const {config:{
  OPENAI_API_KEY,
  AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_API_VERSION,
  DEFAULT_MODEL,
  proxyObject, proxyString
}} = require('../utils/loadConfig.js')

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  httpAgent: new HttpsProxyAgent(proxyString),
  timeout: 40000
})
const openaiChat = ({ model = DEFAULT_MODEL, messages, functions, function_call }) => {
  return openai.chat.completions.create({
    model, messages, functions, function_call,
    presence_penalty: 0.2,
    frequency_penalty: 0.2
  })
}
const openaiChatStream = async function* ({ model = DEFAULT_MODEL, messages }) {
  const response = await openai.chat.completions.create({
      model, messages,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
  })
  for await (const part of response) {
    if (_.get(part, 'choices[0].delta.finish_reason') === 'stop') return
    const token = _.get(part, 'choices[0].delta.content')
    if (token) yield token
  }
}

const openaiEmbedding = ({ input, model = 'text-embedding-ada-002' })=>{
  return openai.embeddings.create({
    model, input
  })
  .then(res => {
    return _.get(res, 'data[0].embedding')
  })
}

const azureOpenaiChat = ({ model = DEFAULT_MODEL, messages, timeoutMs = 40000 }) => {
  model = model.replace('.', '')
  return axios.post(
    `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}/chat/completions?api-version=${AZURE_API_VERSION}`,
    { messages },
    {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY,
      },
      proxy: proxyObject
    }
  )
}
const azureOpenaiChatStream = async function* ({ model = DEFAULT_MODEL, messages, timeoutMs = 20000 }) {
  model = model.replace('.', '')
  let response = await axios.post(
    `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}/chat/completions?api-version=${AZURE_API_VERSION}`,
    {
      messages, stream: true
    },
    {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY,
      },
      proxy: proxyObject,
      responseType: 'stream'
    }
  )
  const decoder = new StringDecoder('utf8')
  let brokeJson = null
  for await (const chunk of response.data) {
    let lines = decoder.write(chunk)
    if (brokeJson !== null) {
      lines = brokeJson + lines
      brokeJson = null
    }
    lines = lines.split('\n').filter((line) => line.trim().startsWith('data: '))

    for (const line of lines) {
      const message = line.replace(/^data: /, '')
      if (message === '[DONE]') {
        return
      }
      try {
        const json = JSON.parse(message)
        const token = _.get(json, 'choices[0].delta.content')
        if (token) {
          yield token
        }
      } catch {
        brokeJson = 'data: ' + message
      }
    }
  }
}

const azureOpenaiEmbedding = ({ input, model = 'text-embedding-ada-002', timeoutMs = 20000 })=>{
  return axios.post(
    `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}/embeddings?api-version=${AZURE_API_VERSION}`,
    { input },
    {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY,
      },
      proxy: proxyObject
    }
  ).then(res => {
    return _.get(res, 'data.data[0].embedding')
  })
}


module.exports = {
  openaiChat,
  openaiChatStream,
  openaiEmbedding,
  azureOpenaiChat,
  azureOpenaiChatStream,
  azureOpenaiEmbedding
}