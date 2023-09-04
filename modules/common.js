const OpenAI = require('openai')
const { HttpsProxyAgent } = require('https-proxy-agent')
const _ = require('lodash')

const { config: {
  OPENAI_API_KEY, OPENAI_API_ENDPOINT, DEFAULT_MODEL,
  AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_API_VERSION, AZURE_CHAT_MODEL, AZURE_EMBEDDING_MODEL,
  proxyString
} } = require('../utils/loadConfig.js')

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_API_ENDPOINT ? OPENAI_API_ENDPOINT : 'https://api.openai.com/v1',
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

/**
 * Generates a chat stream using the OpenAI API.
 *
 * @param {object} options - An object containing the following properties:
 *   - model {string}: The model to use for generating the chat stream.
 *   - messages {array}: An array of message objects representing the conversation.
 * @return {generator} A generator that yields tokens from the chat stream.
 */
const openaiChatStream = async function* ({ model = DEFAULT_MODEL, messages, functions, function_call }) {
  let response
  if (functions) {
    response = await openai.chat.completions.create({
      model, messages, functions, function_call,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
    })
  } else {
    response = await openai.chat.completions.create({
      model, messages,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
    })
  }
  for await (const part of response) {
    if (['stop', 'function_call'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
    const token = _.get(part, 'choices[0].delta.content')
    const f_token = _.get(part, 'choices[0].delta.function_call', {})
    if (token || !_.isEmpty(f_token)) yield { token, f_token }
  }
}

const openaiEmbedding = ({ input, model = 'text-embedding-ada-002' }) => {
  return openai.embeddings.create({
    model, input
  })
    .then(res => {
      return _.get(res, 'data[0].embedding')
    })
}

const azureOpenaiChat = ({ model = AZURE_CHAT_MODEL, messages, functions, function_call }) => {
  const azureOpenai = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent: new HttpsProxyAgent(proxyString),
    timeout: 40000
  })

  return azureOpenai.chat.completions.create({
    model, messages, functions, function_call,
    presence_penalty: 0.2,
    frequency_penalty: 0.2
  })
}

const azureOpenaiChatStream = async function* ({ model = AZURE_CHAT_MODEL, messages, functions, function_call }) {
  const azureOpenai = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent: new HttpsProxyAgent(proxyString),
    timeout: 40000
  })

  let response
  if (functions) {
    response = await azureOpenai.chat.completions.create({
      model, messages, functions, function_call,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
    })
  } else {
    response = await azureOpenai.chat.completions.create({
      model, messages,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
    })
  }
  for await (const part of response) {
    if (['stop', 'function_call'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
    const token = _.get(part, 'choices[0].delta.content')
    const f_token = _.get(part, 'choices[0].delta.function_call', {})
    if (token || !_.isEmpty(f_token)) yield { token, f_token }
  }
}

const azureOpenaiEmbedding = ({ input, model = AZURE_EMBEDDING_MODEL }) => {
  const azureEmbedding = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent: new HttpsProxyAgent(proxyString),
    timeout: 40000
  })

  return azureEmbedding.embeddings.create({
    model, input
  })
    .then(res => {
      return _.get(res, 'data[0].embedding')
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