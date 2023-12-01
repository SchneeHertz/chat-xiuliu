const OpenAI = require('openai')
const { HttpsProxyAgent } = require('https-proxy-agent')
const _ = require('lodash')

const { config: {
  OPENAI_API_KEY, OPENAI_API_ENDPOINT, DEFAULT_MODEL,
  AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_API_VERSION, AZURE_CHAT_MODEL, AZURE_EMBEDDING_MODEL,
  useProxy, proxyObject
} } = require('../utils/loadConfig.js')
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

let httpAgent
try {
  httpAgent = useProxy ? new HttpsProxyAgent(proxyString) :undefined
} catch {}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_API_ENDPOINT ? OPENAI_API_ENDPOINT : 'https://api.openai.com/v1',
  httpAgent,
  timeout: 40000
})


const openaiChat = ({ model = DEFAULT_MODEL, messages, tools, tool_choice }) => {
  if (tools) {
    return openai.chat.completions.create({
      model, messages, tools, tool_choice,
      max_tokens: 4096,
    })
  } else {
    return openai.chat.completions.create({
      model, messages,
      max_tokens: 4096,
    })
  }
}

/**
 * Generates a chat stream using the OpenAI API.
 *
 * @param {object} options - An object containing the following properties:
 *   - model {string}: The model to use for generating the chat stream.
 *   - messages {array}: An array of message objects representing the conversation.
 * @return {generator} A generator that yields tokens from the chat stream.
 */
const openaiChatStream = async function* ({ model = DEFAULT_MODEL, messages, tools, tool_choice }) {
  let response
  if (tools) {
    response = await openai.chat.completions.create({
      model, messages, tools, tool_choice,
      stream: true,
      max_tokens: 4096,
    })
  } else {
    response = await openai.chat.completions.create({
      model, messages,
      stream: true,
      max_tokens: 4096,
    })
  }
  for await (const part of response) {
    if (['stop', 'tool_calls'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
    const token = _.get(part, 'choices[0].delta.content')
    const f_token = _.get(part, 'choices[0].delta.tool_calls', [])
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

const openaiImageCreate = async ({ model = 'dall-e-3', prompt, n = 1, size = '1024x1024', quality = 'standard', style = 'vivid' }) => {
  const response = await openai.images.generate({
    model, prompt, n, size, quality, style
  })
  return JSON.stringify(response.data[0])
}

const azureOpenaiChat = ({ model = AZURE_CHAT_MODEL, messages, tools, tool_choice }) => {
  const azureOpenai = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent,
    timeout: 40000
  })

  if (tools) {
    return azureOpenai.chat.completions.create({
      model, messages, tools, tool_choice,
      max_tokens: 4096,
    })
  } else {
    return azureOpenai.chat.completions.create({
      model, messages,
      max_tokens: 4096,
    })
  }
}

const azureOpenaiChatStream = async function* ({ model = AZURE_CHAT_MODEL, messages, tools, tool_choice }) {
  const azureOpenai = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent,
    timeout: 40000
  })

  let response
  if (tools) {
    response = await azureOpenai.chat.completions.create({
      model, messages, tools, tool_choice,
      stream: true,
      max_tokens: 4096,
    })
  } else {
    response = await azureOpenai.chat.completions.create({
      model, messages,
      stream: true,
      max_tokens: 4096,
    })
  }
  for await (const part of response) {
    if (['stop', 'tool_calls'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
    const token = _.get(part, 'choices[0].delta.content')
    const f_token = _.get(part, 'choices[0].delta.tool_calls', [])
    if (token || !_.isEmpty(f_token)) yield { token, f_token }
  }
}

const azureOpenaiEmbedding = ({ input, model = AZURE_EMBEDDING_MODEL }) => {
  const azureEmbedding = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent,
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
  openaiImageCreate,
  azureOpenaiChat,
  azureOpenaiChatStream,
  azureOpenaiEmbedding
}