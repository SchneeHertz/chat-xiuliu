<script setup>
import { ref } from 'vue'
import { MdSettings, MdFolderOpen } from '@vicons/ionicons4'

import Dialog from './Dialog.vue'

const dialogRef = ref(null)

// setting
const showSettingModal = ref(false)
const config = ref({})
const openConfig = async () => {
  config.value = await ipcRenderer.invoke('load-setting')
  showSettingModal.value = true
}
const saveSettingAndRestart = async () => {
  await ipcRenderer.invoke('save-setting', JSON.parse(JSON.stringify(config.value)))
  await ipcRenderer.invoke('restart-app')
}
const cancelSetting = () => {
  showSettingModal.value = false
}

const model_options = [
  { label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
  { label: 'gpt-3.5-turbo-16k', value: 'gpt-3.5-turbo-16k' },
  { label: 'gpt-4', value: 'gpt-4' },
  { label: 'gpt-4-32k', value: 'gpt-4-32k' },
]

const parseNumber = (str) => {
  let parsed = +str
  if (Number.isInteger(parsed)) return parsed
  return 0
}

const chooseWriteFolder = async () => {
  let folder = await ipcRenderer.invoke('select-folder')
  config.value.writeFolder = folder
}

const alertJSPRisk = (val) => {
  if (val) {
    dialogRef.value.dialog.warning({
      title: '警告',
      content: '可以调用更多模块和功能来执行代码，但冒失的AI可能会执行危险的代码影响你的系统',
      positiveText: '确定',
      negativeText: '取消',
      maskClosable: false,
      onClose: () => {
        config.value.allowPowerfulInterpreter = false
      },
      onPositiveClick: () => {
        config.value.allowPowerfulInterpreter = true
      },
      onNegativeClick: () => {
        config.value.allowPowerfulInterpreter = false
      }
    })
  }
}

defineExpose({
  openConfig
})

</script>
<template>
  <n-button type="primary" tertiary @click="openConfig">
    <template #icon>
      <n-icon>
        <MdSettings />
      </n-icon>
    </template>
  </n-button>
  <n-modal v-model:show="showSettingModal" preset="dialog" title="设置" positive-text="保存后重启应用" negative-text="取消"
    @positive-click="saveSettingAndRestart" @negative-click="cancelSetting" :show-icon="false" :style="{ width: '51em' }">
    <n-form ref="formRef" :model="config" label-placement="left" label-width="auto" require-mark-placement="right-hanging"
      size="small">
      <n-form-item label="使用Azure OpenAI" path="useAzureOpenai">
        <n-switch v-model:value="config.useAzureOpenai" />
      </n-form-item>
      <n-form-item label="OPENAI_API_KEY" path="OPENAI_API_KEY" v-show="!config.useAzureOpenai">
        <n-input v-model:value="config.OPENAI_API_KEY" placeholder="sk-48chars" type="password"
          show-password-on="click" />
      </n-form-item>
      <n-form-item label="OPENAI_API_ENDPOINT" path="OPENAI_API_ENDPOINT" v-show="!config.useAzureOpenai">
        <n-input v-model:value="config.OPENAI_API_ENDPOINT" placeholder="like https://api.openai.com/v1" />
      </n-form-item>
      <n-form-item label="DEFAULT_MODEL" path="DEFAULT_MODEL" v-show="!config.useAzureOpenai">
        <n-select v-model:value="config.DEFAULT_MODEL" :options="model_options" />
      </n-form-item>
      <n-form-item label="AZURE_OPENAI_KEY" path="AZURE_OPENAI_KEY" v-show="config.useAzureOpenai">
        <n-input v-model:value="config.AZURE_OPENAI_KEY" placeholder="32chars" type="password" show-password-on="click" />
      </n-form-item>
      <n-form-item label="AZURE_OPENAI_ENDPOINT" path="AZURE_OPENAI_ENDPOINT" v-show="config.useAzureOpenai">
        <n-input v-model:value="config.AZURE_OPENAI_ENDPOINT" placeholder="endpoint-name" />
      </n-form-item>
      <n-form-item label="AZURE_API_VERSION" path="AZURE_API_VERSION" v-show="config.useAzureOpenai">
        <n-input v-model:value="config.AZURE_API_VERSION" placeholder="like 2023-07-01-preview" />
      </n-form-item>
      <n-form-item label="AZURE_CHAT_MODEL" path="AZURE_CHAT_MODEL" v-show="config.useAzureOpenai">
        <n-input v-model:value="config.AZURE_CHAT_MODEL" placeholder="like gpt-35-turbo-16k" />
      </n-form-item>
      <n-form-item label="AZURE_EMBEDDING_MODEL" path="AZURE_EMBEDDING_MODEL" v-show="config.useAzureOpenai">
        <n-input v-model:value="config.AZURE_EMBEDDING_MODEL" placeholder="like text-embedding-ada-002" />
      </n-form-item>
      <n-form-item label="SpeechSynthesisVoiceName" path="SpeechSynthesisVoiceName">
        <n-input v-model:value="config.SpeechSynthesisVoiceName" placeholder="like zh-CN-XiaoyiNeural" />
      </n-form-item>
      <n-form-item label="你的称呼" path="ADMIN_NAME">
        <n-input v-model:value="config.ADMIN_NAME" />
      </n-form-item>
      <n-form-item label="AI的名字" path="AI_NAME">
        <n-input v-model:value="config.AI_NAME" />
      </n-form-item>
      <n-form-item label="设定" path="systemPrompt">
        <n-input v-model:value="config.systemPrompt" placeholder="AI的设定，chatgpt的默认值是'You are a helpful assistant.'"
          type="textarea" :autosize="{
            minRows: 2,
            maxRows: 4
          }" />
      </n-form-item>
      <n-form-item label="可写文件夹" path="writeFolder">
        <n-input-group>
          <n-input v-model:value="config.writeFolder" placeholder="允许AI写入文件的文件夹" />
          <n-button type="default" @click="chooseWriteFolder">
            <n-icon>
              <MdFolderOpen />
            </n-icon>
          </n-button>
        </n-input-group>
      </n-form-item>
      <n-form-item label="使用高级解释器" path="allowPowerfulInterpreter">
        <n-switch v-model:value="config.allowPowerfulInterpreter" @update:value="alertJSPRisk" />
      </n-form-item>
      <n-form-item label="函数调用轮次限制" path="functionCallingRoundLimit">
        <n-input-number v-model:value="config.functionCallingRoundLimit" :precision="0" :min="0" :parse="parseNumber"/>
      </n-form-item>
      <n-form-item label="使用代理服务器" path="useProxy">
        <n-switch v-model:value="config.useProxy" />
      </n-form-item>
      <n-form-item label="代理服务器" :show-feedback="false" v-show="config.useProxy">
        <n-grid :cols="24" :x-gap="8">
          <n-form-item-gi path="proxyObject.protocol" :span="4">
            <n-input v-model:value="config.proxyObject.protocol" title="protocol, like http"/>
          </n-form-item-gi>
          <n-form-item-gi path="proxyObject.host" :span="8">
            <n-input v-model:value="config.proxyObject.host" title="host, like 127.0.0.1" />
          </n-form-item-gi>
          <n-form-item-gi path="proxyObject.port" :span="4">
            <n-input-number v-model:value="config.proxyObject.port" title="port, like 7890" :show-button="false" />
          </n-form-item-gi>
        </n-grid>
      </n-form-item>
    </n-form>
  </n-modal>
  <n-dialog-provider>
    <Dialog ref="dialogRef" />
  </n-dialog-provider>
</template>