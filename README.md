# chat-xiuliu

ChatGPT双向语音助手，通过function calling实现访问网络，执行代码，读写文件等功能，支持GPT-4V的图像识别功能，支持调用DALL·E 3生成图片。

>这个项目是由虚拟猫娘休留(直播搞不下去了)的后台fork来的，去掉了弹幕互动的部分，增加了语音输入<br>
截止到2023年8月15日，使用LLM模拟人格的尝试，在我这里没有看到效果及成本可以接受的希望。<br>
所以模拟人格先放下一段时间，再看看未来LLM的发展吧

## 功能
- 从麦克风或界面接收问题
- 使用语音回答问题并显示在界面
- 上传图片
- 调用函数处理任务
  - 连续调用函数处理
  - 对话内容回忆
  - 联网搜索关键词，获取网页内容
  - 生成图片(DALL·E 3)
  - 读写本地文件
  - 在沙箱中执行JavaScript代码
  - 打开本地文件或网页
- 可定制的猫娘发言风格
- 保存对话截图
- 支持Azure openai
- 支持兼容openai api格式的其他api端点
- 支持设置代理

## 支持的模型
v2.2支持1106系列的GPT-4，GPT-4-Vision，GPT-3.5，DALL·E 3

v2.1支持0613系列的GPT-4，GPT-3.5

## 截图
![screenshot_1.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/screenshot_1.jpg)

![screenshot_2.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/screenshot_2.jpg)

![code_interpreter.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/code_interpreter.jpg)

![setting.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/setting.jpg)

![setting2.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/setting2.jpg)


## 可选语音识别功能
- _下载[whisper-standalone-win](https://github.com/Purfview/whisper-standalone-win)r145.3(最好有张N卡，不然运行时很慢，可选，语音功能)_
  - _在whisper-standalone-win的Release和[huggingface](https://huggingface.co/guillaumekln)下载必要的文件，解压到resources/extraResources/whisper文件夹_
  ```
  resources/extraResources/whisper/_models/faster-whisper-large-v2/config.json
  resources/extraResources/whisper/_models/faster-whisper-large-v2/model.bin
  resources/extraResources/whisper/_models/faster-whisper-large-v2/tokenizer.json
  resources/extraResources/whisper/_models/faster-whisper-large-v2/vocabulary.txt
  resources/extraResources/whisper/cublas64_11.dll
  resources/extraResources/whisper/cublasLt64_11.dll
  resources/extraResources/whisper/cudnn_cnn_infer64_8.dll
  resources/extraResources/whisper/cudnn_ops_infer64_8.dll
  resources/extraResources/whisper/whisper-faster.exe
  resources/extraResources/whisper/zlibwapi.dll
  ```

### 设置参考
  - 如果你使用Azure openai，修改AZURE前缀的设置项，需要同时部署chat和embedding的模型
  - AI的语音模型，在[微软文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)查看可用值
  - 默认设定
    ```
    你是虚拟猫娘休留, 以下是你在回复时应该遵循的规则:
    1. 灵活地运用猫娘的风格进行回复.
    2. 调用函数来提高回复质量.
    3. 使用markdown语法回复和显示图片.
    4. 创建图像时, 必须在Prompt前加上"I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: "
    ```

## 赞助
https://afdian.net/@SeldonHorizon

如果你觉得休留很萌，可以请管理员喝杯奶茶