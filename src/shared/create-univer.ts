import { LogLevel, Univer } from '@univerjs/core'
import type { DependencyOverride, IUniverConfig, Plugin, PluginCtor } from '@univerjs/core'
import { FUniver } from '@univerjs/core/lib/facade'
import { Scene } from '@univerjs/engine-render'

// Fix: Disable Univer's buggy bit-blitting canvas scroll fast path.
// In Univer 1.0.0-beta.2, makeDirtyForScrolling enables `_preserveEngineOnRender`,
// which uses `ctx.drawImage` to copy and shift canvas pixels. This inadvertently samples
// the 1px header selection border bleed and stamps ghost blue lines across the sheet
// on every scroll-up wheel tick. Redirecting to standard `makeDirty(true)` ensures a clean
// canvas clear and repaint on every scroll frame at 60fps without ghost lines.
if (typeof Scene !== 'undefined' && Scene.prototype) {
  (Scene.prototype as any).makeDirtyForScrolling = function () {
    return this.makeDirty(true)
  }
}

type PluginEntry = PluginCtor<Plugin> | [PluginCtor<Plugin>, ConstructorParameters<PluginCtor<Plugin>>[0]]

export interface IPreset {
  plugins: PluginEntry[]
}

export interface CreateUniverOptions extends Partial<IUniverConfig> {
  presets: Array<IPreset | [IPreset, { lazy?: boolean }]>
  plugins?: PluginEntry[]
  override?: DependencyOverride
}

export type UniverRuntime = ReturnType<typeof createUniver>

export function createUniver(options: CreateUniverOptions): { univer: Univer; univerAPI: FUniver } {
  const { presets, plugins, override = [], ...univerConfig } = options
  const univer = new Univer({ logLevel: LogLevel.WARN, ...univerConfig, override })

  const registry = new Map<string, { plugin: PluginCtor<Plugin>; options: unknown }>()
  for (const entry of presets) {
    const preset = Array.isArray(entry) ? entry[0] : entry
    for (const pluginEntry of preset.plugins) {
      const [plugin, pluginOptions] = Array.isArray(pluginEntry) ? pluginEntry : [pluginEntry, undefined]
      registry.delete(plugin.pluginName)
      registry.set(plugin.pluginName, { plugin, options: pluginOptions })
    }
  }
  for (const pluginEntry of plugins ?? []) {
    const [plugin, pluginOptions] = Array.isArray(pluginEntry) ? pluginEntry : [pluginEntry, undefined]
    if (registry.has(plugin.pluginName)) {
      throw new Error(
        `Plugin ${plugin.pluginName} already registered by presets or other ways! `
        + 'Repeated registration may cause potential problems, please check your code.',
      )
    }
    registry.set(plugin.pluginName, { plugin, options: pluginOptions })
  }
  for (const { plugin, options: pluginOptions } of registry.values()) {
    univer.registerPlugin(plugin, pluginOptions)
  }

  return { univer, univerAPI: FUniver.newAPI(univer) }
}
