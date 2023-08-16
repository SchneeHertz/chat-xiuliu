const { StringDecoder } = require('node:string_decoder')
const { Configuration, OpenAIApi } = require('openai')
const axios = require('axios')
const _ = require('lodash')
const { config } = require('../utils/initFile.js')

const {
  OPENAI_API_KEY,
  AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_API_VERSION,
  DEFAULT_MODEL,
  proxyObject,
} = config

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)
const openaiChat = ({ model = DEFAULT_MODEL, messages, functions, function_call, timeoutMs = 40000 }) => {
  return openai.createChatCompletion({
    model, messages, functions, function_call,
    presence_penalty: 0.2,
    frequency_penalty: 0.2
  }, {
    timeout: timeoutMs,
    proxy: proxyObject
  })
}
const openaiChatStream = async function* ({ model = DEFAULT_MODEL, messages, timeoutMs = 20000 }) {
  const response = await openai.createChatCompletion(
    {
      model, messages,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
    },
    {
      timeout: timeoutMs,
      proxy: proxyObject,
      responseType: 'stream',
    },
  )

  for await (const chunk of response.data) {
    const lines = chunk
      .toString('utf8')
      .split('\n')
      .filter((line) => line.trim().startsWith('data: '))

    for (const line of lines) {
      const message = line.replace(/^data: /, '')
      if (message === '[DONE]') {
        return
      }

      const json = JSON.parse(message)
      const token = _.get(json, 'choices[0].delta.content')
      const functionName = _.get(json, 'choices[0].delta.function_call.name')
      if (functionName) console.log('!!!second function call ' + functionName)
      if (token) {
        yield token
      }
    }
  }
}

const openaiEmbedding = ({ input, model = 'text-embedding-ada-002', timeoutMs = 20000 })=>{
  return openai.createEmbedding({
    model, input
  }, {
    timeout: timeoutMs,
    proxy: proxyObject
  })
  .then(res => {
    return _.get(res, 'data.data[0].embedding')
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