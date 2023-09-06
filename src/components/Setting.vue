<script setup>
import { ref } from 'vue'
import { MdSettings } from '@vicons/ionicons4'
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

</script>
<template>
<n-dialog-provider>
  <n-button type="primary" tertiary @click="openConfig">
    <template #icon>
      <n-icon><MdSettings /></n-icon>
    </template>
  </n-button>
  <n-modal
    v-model:show="showSettingModal"
    preset="dialog"
    title="设置"
    positive-text="保存后重启应用"
    negative-text="取消"
    @positive-click="saveSettingAndRestart"
    @negative-click="cancelSetting"
  >
    test
  </n-modal>
</n-dialog-provider>
</template>