import type { marked } from 'marked'
import type { TokenExtractionParameters } from '@magidoc/plugin-svelte-marked'

const notificationStyles = ['error', 'success', 'info', 'warning'] as const
export type NotificationStyle = (typeof notificationStyles)[number]

export type NotificationToken = marked.Tokens.Generic & {
  type: 'notification'
  style: NotificationStyle
  raw: string
  tokens: marked.Token[]
}

export function parseNotification({
  options,
  raw,
}: TokenExtractionParameters): NotificationToken {
  const typeOption =
    options['type']?.toString()?.toLocaleLowerCase()?.trim() ?? 'info'
  const style: NotificationStyle = notificationStyles.some(
    (it) => it === typeOption,
  )
    ? (typeOption as NotificationStyle)
    : 'info'

  return {
    type: 'notification',
    raw: raw,
    style: style,
    tokens: [],
  }
}
