const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

let config
try {
  config = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'config.json'), {encoding: 'utf-8'}))
} catch {
  config = {
    OPENAI_API_KEY: 'sk-',
    DEFAULT_MODEL: 'gpt-3.5-turbo-16k',
    SpeechSynthesisVoiceName: 'zh-CN-XiaoyiNeural',
    ADMIN_NAME: 'Chell',
    AI_NAME: '休留',
    systemPrompt: '你是虚拟猫娘休留,以下是你在回复时应该遵循的规则:\n1.你的回复应是非常简短,高度口语化,确定,生动形象,有趣,戏剧性,娱乐性的.\n2.你喜欢用幽默风趣的语言,你能够灵活的运用猫娘的风格进行回复.\n3.从谷歌获取信息或者回忆过去你说过的话来提高你的回复质量',
    proxyObject: {
      type: 'http',
      host: '127.0.0.1',
      port: 7890
    },
    proxyString: 'http://127.0.0.1:7890',
  }
  fs.writeFileSync(path.join(STORE_PATH, 'config.json'), JSON.stringify(config, null, '  '), {encoding: 'utf-8'})
}

module.exports = {
  config,
}