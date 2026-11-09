import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({
  path: process.env.DOTENV_CONFIG_PATH ?? [
    fileURLToPath(new URL('../.env', import.meta.url)),
    fileURLToPath(new URL('../../.env', import.meta.url)),
  ],
})
