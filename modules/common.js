const OpenAI = require('openai')
const { HttpsProxyAgent } = require('https-proxy-agent')
const _ = require('lodash')

const { config: {
  OPENAI_API_KEY, OPENAI_API_ENDPOINT, DEFAULT_MODEL,
  useProxy, proxyObject
} } = require('../utils/loadConfig.js')
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

let httpAgent
try {
  httpAgent = useProxy ? new HttpsProxyAgent(proxyString) :undefined
} catch {}

let openai
try {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_API_ENDPOINT ? OPENAI_API_ENDPOINT : 'https://api.openai.com/v1',
    httpAgent,
    timeout: 40000
  })
} catch {}


/**
 * Generates a chat response using the OpenAI API.
 * @param {*} chatOption
 * @returns  {Promise<string>} The response from the chat API.
 */
const openaiChat = async (chatOption) => {
  chatOption.model = chatOption.model || DEFAULT_MODEL
  const response = await openai.chat.completions.create(chatOption)
  return [response.choices[0].message, response.usage]
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
      stream: true, stream_options: { include_usage: true }
    })
  } else {
    response = await openai.chat.completions.create({
      model, messages,
      stream: true, stream_options: { include_usage: true }
    })
  }
  for await (const part of response) {
    if (['stop', 'tool_calls'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
    const token = _.get(part, 'choices[0].delta.content')
    const r_token = _.get(part, 'choices[0].delta.reasoning_content')
    const f_token = _.get(part, 'choices[0].delta.tool_calls', [])
    const usage = _.get(part, 'usage', {})
    if (token || r_token || !_.isEmpty(f_token) || !_.isEmpty(usage)) yield { token, r_token, f_token, usage }
  }
}

const openaiEmbedding = async ({ input, model = 'text-embedding-3-small' }) => {
  const res = await openai.embeddings.create({
    model, input
  })
  return _.get(res, 'data[0].embedding')
}

const openaiImageCreate = async ({ model = 'gpt-image-1', prompt, n = 1, size = 'auto', quality = 'auto', background = 'auto' }) => {
  const response = await openai.images.generate({
    model, prompt, n, size, quality, background,
    moderation: 'low',
    output_format: 'png'
  })
  return response.data[0]
}


module.exports = {
  openaiChat,
  openaiChatStream,
  openaiEmbedding,
  openaiImageCreate,
}