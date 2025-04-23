import { defineStore } from 'pinia'

export const useMainStore = defineStore('main', {
  state:() => ({
    messageList: [],
    savedMessageList: [],
    tempMessageList: [],
    isLiving: false,
  })
})