import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationStore } from '../store/notificationSlice'

beforeEach(() => {
  useNotificationStore.setState({ notification: null })
})

describe('notification store', () => {
  it('starts with nothing to show', () => {
    expect(useNotificationStore.getState().notification).toBeNull()
  })

  it('notify stores kind, title and message', () => {
    useNotificationStore.getState().notify('warning', '标题', '正文')
    expect(useNotificationStore.getState().notification).toEqual({
      kind: 'warning',
      title: '标题',
      message: '正文',
    })
  })

  it('notifyError defaults the title', () => {
    useNotificationStore.getState().notifyError('出错了')
    const n = useNotificationStore.getState().notification
    expect(n?.kind).toBe('error')
    expect(n?.message).toBe('出错了')
    expect(n?.title).toBe('操作未能完成')
  })

  it('notifyError accepts an explicit title', () => {
    useNotificationStore.getState().notifyError('原因', '无法插入图表')
    expect(useNotificationStore.getState().notification?.title).toBe('无法插入图表')
  })

  it('a later notification replaces the earlier one', () => {
    useNotificationStore.getState().notifyError('第一条')
    useNotificationStore.getState().notify('info', '提示', '第二条')
    expect(useNotificationStore.getState().notification?.message).toBe('第二条')
  })

  it('dismiss clears the notification', () => {
    useNotificationStore.getState().notifyError('出错了')
    useNotificationStore.getState().dismissNotification()
    expect(useNotificationStore.getState().notification).toBeNull()
  })

  it('dismiss does not notify subscribers when nothing is shown', () => {
    let notifications = 0
    const unsubscribe = useNotificationStore.subscribe(() => {
      notifications += 1
    })

    useNotificationStore.getState().dismissNotification()
    expect(notifications).toBe(0)

    useNotificationStore.getState().notifyError('出错了')
    useNotificationStore.getState().dismissNotification()
    expect(notifications).toBe(2)

    unsubscribe()
  })
})
