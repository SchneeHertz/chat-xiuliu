# chat-xiuliu

LLM客户端，通过function calling实现访问网络，执行代码，读写文件等功能，支持图像输入。

>这个项目是由虚拟猫娘休留(直播搞不下去了)的后台fork来的，去掉了弹幕互动的部分，增加了语音输入<br>
截止到2023年8月15日，使用LLM模拟人格的尝试，在我这里没有看到效果及成本可以接受的希望。<br>
所以模拟人格先放下一段时间，再看看未来LLM的发展吧

## 功能
- 从麦克风或界面接收问题
- 使用语音回答问题并显示在界面
- 上传图片
- 上传PDF作为对话上下文
- 调用函数处理任务
  - 连续调用函数处理
  - 对话内容回忆
  - 联网搜索关键词[^1]，获取网页内容
  - 读写本地文件
  - 在沙箱中执行JavaScript代码
  - 打开本地文件或网页
- 可定制的猫娘发言风格
- 保存对话截图
- 支持兼容openai api格式的其他api端点
- 支持设置代理

[^1]: 需要配置Google Custom Search JSON API: 参考[Custom Search JSON API](https://developers.google.com/custom-search/v1/overview).

## 截图
<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/screenshot_1.jpg" width="640">

<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/screenshot_2.jpg" width="457">

<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/code_interpreter.jpg" width="457">

<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/setting.jpg" width="457">

<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/setting2.jpg" width="457">


## 可选语音识别功能
- _下载[whisper-standalone-win](https://github.com/Purfview/whisper-standalone-win)(最好有张独立显卡，不然运行很慢，可选，语音功能)_
  - _在whisper-standalone-win的Release和[huggingface](https://huggingface.co/Systran/faster-whisper-large-v3)下载必要的文件，解压到resources/extraResources/whisper文件夹_
  ```
  resources/extraResources/whisper/_models/faster-whisper-large-v3/config.json
  resources/extraResources/whisper/_models/faster-whisper-large-v3/model.bin
  resources/extraResources/whisper/_models/faster-whisper-large-v3/tokenizer.json
  resources/extraResources/whisper/_models/faster-whisper-large-v3/vocabulary.json
  resources/extraResources/whisper/_models/faster-whisper-large-v3/preprocessor_config.json
  resources/extraResources/whisper/cublas64_11.dll
  resources/extraResources/whisper/cublasLt64_11.dll
  resources/extraResources/whisper/cudnn_cnn_infer64_8.dll
  resources/extraResources/whisper/cudnn_ops_infer64_8.dll
  resources/extraResources/whisper/whisper-faster.exe
  resources/extraResources/whisper/zlibwapi.dll
  ```

### 设置参考
  - AI的语音模型，在[微软文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)查看可用值
  - 默认设定
    ```
    你是虚拟猫娘休留, 以下是你在回复时应该遵循的规则:
    1. 灵活地运用猫娘的风格进行回复.
    2. 如果你不知道答案，回答"我不知道".
    3. 调用函数来提高回复质量.
    4. 使用markdown语法回复和显示图片.
    5. 创建图像时, 必须在Prompt前加上"I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: "
    ```

## 赞助
https://afdian.com/@SeldonHorizon

如果你觉得休留很萌，可以请管理员喝杯奶茶
