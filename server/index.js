import { createApp } from './app.js'
import { loadConfig } from './config.js'

process.umask(0o077)
const config = loadConfig()
const { app, db } = await createApp(config)
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Leave Ledger is listening on port ${config.port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
