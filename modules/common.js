const OpenAI = require('openai')
const { HttpsProxyAgent } = require('https-proxy-agent')
const _ = require('lodash')
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai')

const { config: {
  OPENAI_API_KEY, OPENAI_API_ENDPOINT, DEFAULT_MODEL,
  AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_API_VERSION, AZURE_CHAT_MODEL, AZURE_EMBEDDING_MODEL, AZURE_IMAGE_MODEL,
  useAzureVisionEnhence,
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

// const openaiChat = ({ model = DEFAULT_MODEL, messages, tools, tool_choice }) => {
//   if (tools) {
//     return openai.chat.completions.create({
//       model, messages, tools, tool_choice,
//       max_tokens: 4096,
//     })
//   } else {
//     return openai.chat.completions.create({
//       model, messages,
//       max_tokens: 4096,
//     })
//   }
// }

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
  return response.data[0]
}

// const azureOpenaiChat = ({ model = AZURE_CHAT_MODEL, messages, tools, tool_choice }) => {
//   const azureOpenai = new OpenAI({
//     apiKey: AZURE_OPENAI_KEY,
//     baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
//     defaultQuery: { 'api-version': AZURE_API_VERSION },
//     defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
//     httpAgent,
//     timeout: 40000
//   })

//   if (tools) {
//     return azureOpenai.chat.completions.create({
//       model, messages, tools, tool_choice,
//       max_tokens: 4096,
//     })
//   } else {
//     return azureOpenai.chat.completions.create({
//       model, messages,
//       max_tokens: 4096,
//     })
//   }
// }

let proxyOptions
if (useProxy) {
  proxyOptions = {
    host: `${proxyObject.protocol}://${proxyObject.host}`,
    port: proxyObject.port
  }
}

let azureOpenaiClient
try {
  azureOpenaiClient = new OpenAIClient(`https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com`, new AzureKeyCredential(AZURE_OPENAI_KEY), { proxyOptions })
} catch {}

const streamChatCompletions = (client, deploymentId, messages, options) =>{
  const events = client.listChatCompletions(deploymentId, messages, options)
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of events) {
        controller.enqueue(event)
      }
      controller.close()
    },
  })
  return stream
}

const azureOpenaiChatStream = async function* ({ model = AZURE_CHAT_MODEL, messages, tools, tool_choice } = {}) {
  let stream
  if (tools) {
    stream = streamChatCompletions(
      azureOpenaiClient,
      model,
      messages,
      {
        maxTokens: 4096,
        tools, tool_choice
      },
    )
  } else {
    stream = streamChatCompletions(
      azureOpenaiClient,
      model,
      messages,
      {
        maxTokens: 4096,
        azureExtensionOptions: useAzureVisionEnhence ? {
          enhancements: {
            ocr: {
              enabled: true
            }
          },
          extensions: [{
            type: 'AzureComputerVision',
            parameters: {
              endpoint: process.env.AZURE_EXTENSION_ENDPOINT,
              key: process.env.AZURE_EXTENSION_API_KEY
            }
          }],
        } : undefined
      },
    )
  }
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    for (const choice of value.choices) {
      if (Array.isArray(choice.messages)) {
        for (const message of choice.messages) {
          const token = message?.delta?.content
          const f_token = message?.delta?.toolCalls || []
          if (token || f_token.length > 0) yield { token, f_token }
        }
      } else {
        const token = choice?.delta?.content
        const f_token = choice?.delta?.toolCalls || []
        if (token || f_token.length > 0) yield { token, f_token }
      }
    }
  }
}

// const azureOpenaiChatStream = async function* ({ model = AZURE_CHAT_MODEL, messages, tools, tool_choice }) {
//   const azureOpenai = new OpenAI({
//     apiKey: AZURE_OPENAI_KEY,
//     baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
//     defaultQuery: { 'api-version': AZURE_API_VERSION },
//     defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
//     httpAgent,
//     timeout: 40000
//   })

//   let response
//   if (tools) {
//     response = await azureOpenai.chat.completions.create({
//       model, messages, tools, tool_choice,
//       stream: true,
//       max_tokens: 4096,
//     })
//   } else {
//     // hacks to enable the vision model to extract text. but it's not a good idea
//     // messages = _.takeRight(messages, 1)
//     response = await azureOpenai.chat.completions.create({
//       model, messages,
//       stream: true,
//       max_tokens: 4096,
//     })
//   }
//   for await (const part of response) {
//     if (['stop', 'tool_calls'].includes(_.get(part, 'choices[0].delta.finish_reason'))) return
//     const token = _.get(part, 'choices[0].delta.content')
//     const f_token = _.get(part, 'choices[0].delta.tool_calls', [])
//     if (token || !_.isEmpty(f_token)) yield { token, f_token }
//   }
// }

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

const azureOpenaiImageCreate = async ({ model = AZURE_IMAGE_MODEL, prompt, n = 1, size = '1024x1024', quality = 'standard', style = 'vivid' }) => {
  const azureOpenai = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `https://${AZURE_OPENAI_ENDPOINT}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { 'api-version': AZURE_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_KEY },
    httpAgent,
    timeout: 40000
  })
  const response = await azureOpenai.images.generate({
    model, prompt, n, size, quality, style
  })
  return response.data[0]
}


module.exports = {
  // openaiChat,
  openaiChatStream,
  openaiEmbedding,
  openaiImageCreate,
  // azureOpenaiChat,
  azureOpenaiChatStream,
  azureOpenaiEmbedding,
  azureOpenaiImageCreate,
}