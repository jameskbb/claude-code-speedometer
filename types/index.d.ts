export type SpeedoRateLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type SpeedoUsage = {
  percent?: number
  tokens?: number
  window: number
  rateLimits: SpeedoRateLimit[]
  usd?: number
}
export type SpeedoLimit = { kind: string; label: string; percent: number; resetsAt?: string }
export type SpeedoAgent = {
  id: string
  type: string
  description: string
  model: string
  status: 'running' | 'done'
  tokens?: number
  tools: number
  startedAt: number
  endedAt?: number
}
export type SpeedoTurn = { count: number; lastMs: number; tools: number }
export type SpeedoMode = 'idle' | 'working' | 'tool'

declare module 'claude-code' {
  interface PluginState {
    speedometer: {
      usage: Shaped<SpeedoUsage | null>
      limits: Shaped<SpeedoLimit[] | null>
      agents: Shaped<SpeedoAgent[]>
      ponytail: string | null
      warnings: Shaped<Record<string, number>>
      agentsOpen: boolean
      turn: Shaped<SpeedoTurn>
      mode: SpeedoMode
      warned: number
    }
  }
}
