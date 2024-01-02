const { app } = require('electron')
const path = require('node:path')

const sanitizeFilename = (filename) => {
  return filename.replace(/[<>:"\/\\|?*]/g, '_')
}

const getRootPath = () => {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'))
  } else {
    return app.getAppPath()
  }
}

const STORE_PATH = path.join(getRootPath(), 'data')

module.exports = {
  sanitizeFilename,
  getRootPath,
  STORE_PATH
}