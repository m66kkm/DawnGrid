import { beforeEach, describe, expect, it } from 'vitest'
import { useDocumentStore } from '../store/documentSlice'

const initial = useDocumentStore.getState()

beforeEach(() => {
  useDocumentStore.setState({
    currentFile: null,
    metadata: null,
    status: '就绪',
    loading: false,
    activeSheetId: 'sheet-1',
    definedNames: initial.definedNames,
  })
})

describe('document store defaults', () => {
  it('matches the pre-migration App defaults', () => {
    const s = useDocumentStore.getState()
    expect(s.currentFile).toBeNull()
    expect(s.metadata).toBeNull()
    expect(s.status).toBe('就绪')
    expect(s.loading).toBe(false)
    expect(s.activeSheetId).toBe('sheet-1')
    expect(s.definedNames).toEqual([
      { name: 'SalesData', ref: '=Sheet1!$A$1:$D$10', scope: '工作簿' },
    ])
  })
})

describe('setStatus', () => {
  it('stores a new status', () => {
    useDocumentStore.getState().setStatus('已保存')
    expect(useDocumentStore.getState().status).toBe('已保存')
  })

  // Written from ~230 call sites, many of them re-setting the same text; skipping
  // the notification keeps those from re-rendering the status line.
  it('does not notify subscribers when the status is unchanged', () => {
    useDocumentStore.getState().setStatus('已保存')

    let notifications = 0
    const unsubscribe = useDocumentStore.subscribe(() => {
      notifications += 1
    })

    useDocumentStore.getState().setStatus('已保存')
    expect(notifications).toBe(0)

    useDocumentStore.getState().setStatus('就绪')
    expect(notifications).toBe(1)

    unsubscribe()
  })
})

describe('setLoading and setActiveSheetId', () => {
  it('round-trip loading', () => {
    useDocumentStore.getState().setLoading(true)
    expect(useDocumentStore.getState().loading).toBe(true)
  })

  it('skip notification when loading is unchanged', () => {
    let notifications = 0
    const unsubscribe = useDocumentStore.subscribe(() => {
      notifications += 1
    })

    useDocumentStore.getState().setLoading(false)
    expect(notifications).toBe(0)

    unsubscribe()
  })

  it('round-trip activeSheetId', () => {
    useDocumentStore.getState().setActiveSheetId('sheet-2')
    expect(useDocumentStore.getState().activeSheetId).toBe('sheet-2')
  })

  it('skip notification when the sheet id is unchanged', () => {
    useDocumentStore.getState().setActiveSheetId('sheet-2')

    let notifications = 0
    const unsubscribe = useDocumentStore.subscribe(() => {
      notifications += 1
    })

    useDocumentStore.getState().setActiveSheetId('sheet-2')
    expect(notifications).toBe(0)

    unsubscribe()
  })
})

describe('setCurrentFile', () => {
  it('round-trips a path and back to null', () => {
    useDocumentStore.getState().setCurrentFile('C:/tmp/book.xlsx')
    expect(useDocumentStore.getState().currentFile).toBe('C:/tmp/book.xlsx')
    useDocumentStore.getState().setCurrentFile(null)
    expect(useDocumentStore.getState().currentFile).toBeNull()
  })
})

describe('setDefinedNames', () => {
  it('accepts an array', () => {
    useDocumentStore.getState().setDefinedNames([{ name: 'A', ref: '=B1', scope: '工作簿' }])
    expect(useDocumentStore.getState().definedNames.map((n) => n.name)).toEqual(['A'])
  })

  it('accepts an updater, as the NameManager add/delete handlers use', () => {
    useDocumentStore.getState().setDefinedNames([{ name: 'A', ref: '=B1', scope: '工作簿' }])
    useDocumentStore
      .getState()
      .setDefinedNames((prev) => [...prev, { name: 'B', ref: '=C1', scope: '工作簿' }])
    expect(useDocumentStore.getState().definedNames.map((n) => n.name)).toEqual(['A', 'B'])

    useDocumentStore.getState().setDefinedNames((prev) => prev.filter((n) => n.name !== 'A'))
    expect(useDocumentStore.getState().definedNames.map((n) => n.name)).toEqual(['B'])
  })
})
