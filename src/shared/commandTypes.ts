import type { UniverRuntime } from './create-univer'

/**
 * The Univer handles every command handler resolves before running.
 *
 * handleRibbonCommand resolves these once via getTargetRange() and shares them
 * across all 200 cases, so a handler that needs the grid takes them as one
 * argument rather than re-resolving.
 */
export interface CommandContext {
  runtime: UniverRuntime
  workbook: any
  worksheet: any
  range: any
}

/**
 * Returns true when the command was recognised and handled.
 *
 * Handlers are tried in order, so returning false lets the next domain see the
 * command. Splitting the original switch this way keeps each domain's cases in
 * one place while preserving first-match-wins ordering.
 */
export type CommandHandler = (
  cmd: string,
  ctx: CommandContext,
  ...args: any[]
) => boolean | Promise<boolean>
