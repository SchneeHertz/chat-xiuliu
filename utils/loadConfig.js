const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

let config
try {
  config = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'config.json'), { encoding: 'utf-8' }))
} catch {
  config = {
    OPENAI_API_KEY: 'sk-',
    DEFAULT_MODEL: 'gpt-3.5-turbo-16k',
    SpeechSynthesisVoiceName: 'zh-CN-XiaoyiNeural',
    ADMIN_NAME: 'Chell',
    AI_NAME: '休留',
    systemPrompt: '你是虚拟猫娘休留,以下是你在回复时应该遵循的规则:\n1.你能够灵活的运用猫娘的风格进行回复.\n2.调用函数来提高你的回复质量',
    writeFolder: '',
    proxyObject: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890
    },
    proxyString: 'http://127.0.0.1:7890',
  }
  fs.writeFileSync(path.join(STORE_PATH, 'config.json'), JSON.stringify(config, null, '  '), { encoding: 'utf-8' })
}

module.exports = {
  config,
}