const { Sequelize, DataTypes } = require('sequelize')
const { openaiEmbedding, azureOpenaiEmbedding } = require('./common.js')
const { config: { useAzureOpenai } } = require('../utils/loadConfig.js')
const { join } = require('path')

const useOpenaiEmbeddingFunction = useAzureOpenai ? azureOpenaiEmbedding : openaiEmbedding

function dotProduct(vecA, vecB) {
  return vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0))
}

function cosineSimilarity(vecA, vecB) {
  const dotProd = dotProduct(vecA, vecB)
  const magnitudeA = magnitude(vecA)
  const magnitudeB = magnitude(vecB)
  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProd / (magnitudeA * magnitudeB)
}

// 初始化 SQLite 数据库
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(__dirname, '../data/vector.sqlite'),
  logging: false
})

// 定义 Text 模型
const Text = sequelize.define('Text', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  content: {
    type: DataTypes.JSON,
    allowNull: false
  },
  type: DataTypes.STRING,
  embedding: {
    type: DataTypes.JSON,
    allowNull: false
  }
})

/**
 * 添加文本并生成嵌入向量
 * @param {Object} content - 添加到数据库的内容
 * @param {string} content.text - 文本内容
 * @param {string} type - 文本类型
 * @returns {Promise<void>} - 无返回值
 */
async function addText(content, type) {
  const embedding = await useOpenaiEmbeddingFunction({ input: content.text })
  await Text.create({ content, embedding, type })
}

/**
 * 搜索相似文本
 * @param {string} query - 查询文本
 * @param {number} count - 返回文本数量
 * @returns {Promise<Array>} - 相似文本列表, 按相似度降序排列
 */
async function searchSimilarText(query, count) {
  const queryEmbedding = await useOpenaiEmbeddingFunction({ input: query })
  const texts = await Text.findAll()

  const results = texts.map(item => {
    const similarity = cosineSimilarity(queryEmbedding, item.embedding)
    return { content: item.content, similarity }
  })

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, count)
}

/**
  * 随机获取特定数量的文本
  * @param {number} count - 文本数量
  * @returns {Promise<Array>} - 文本列表
  */
async function getRandomTexts(count) {
  const texts = await Text.findAll({
    order: sequelize.literal('RANDOM()'),
    limit: count
  })
  return texts.map(item => item.content)
}


// 同步数据库
sequelize.sync()

module.exports = {
  addText,
  searchSimilarText,
  getRandomTexts,
  cosineSimilarity
}