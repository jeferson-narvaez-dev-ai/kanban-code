import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import { IncomingMessage } from 'http'
import { URL } from 'url'
import * as fs from 'fs'

export function setupTerminalWS(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract cwd from query string: ws://localhost:3002/terminal?cwd=/Users/foo/my-project
    let cwd = process.env.HOME || process.cwd()
    try {
      const url = new URL(req.url || '', `http://localhost`)
      const queryCwd = url.searchParams.get('cwd')
      if (queryCwd) {
        // Expand ~ to home directory
        const expanded = queryCwd.startsWith('~')
          ? queryCwd.replace('~', process.env.HOME || '')
          : queryCwd
        if (fs.existsSync(expanded)) {
          cwd = expanded
        } else {
          // Directory doesn't exist — will warn inside the terminal after spawn
          cwd = process.env.HOME || process.cwd()
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: `\r\n\x1b[33m⚠ Directory not found: ${expanded}\x1b[0m\r\n\x1b[33m  Update the project path to an existing folder.\x1b[0m\r\n\r\n`
              }))
            }
          }, 500)
        }
      }
    } catch {
      // ignore malformed URLs
    }

    const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'zsh')

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
    })

    // pty → WebSocket
    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
    })

    // WebSocket → pty
    ws.on('message', (msg: Buffer) => {
      try {
        const parsed = JSON.parse(msg.toString())
        if (parsed.type === 'input') {
          ptyProcess.write(parsed.data)
        } else if (parsed.type === 'resize') {
          ptyProcess.resize(parsed.cols, parsed.rows)
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      ptyProcess.kill()
    })
  })
}
