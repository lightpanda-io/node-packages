import { expect, test, vi } from 'vitest'
import { LightpandaError, ProcessError } from '../src/errors.js'

test('errors keep their name', () => {
  expect(new ProcessError('x').name).toBe('ProcessError')
  expect(new LightpandaError('x').name).toBe('LightpandaError')
})

test('instanceof follows the class hierarchy', () => {
  const err = new ProcessError('x')
  expect(err).toBeInstanceOf(ProcessError)
  expect(err).toBeInstanceOf(LightpandaError)
  expect(err).toBeInstanceOf(Error)
  expect(new LightpandaError('x')).not.toBeInstanceOf(ProcessError)
  expect(new Error('x')).not.toBeInstanceOf(LightpandaError)
})

test('a subclass without its own errorName keeps its name and a plain instanceof', () => {
  class TimeoutError extends ProcessError {}
  expect(new TimeoutError('x').name).toBe('TimeoutError')
  expect(new TimeoutError('x')).toBeInstanceOf(TimeoutError)
  expect(new TimeoutError('x')).toBeInstanceOf(ProcessError)
  expect(new TimeoutError('x')).toBeInstanceOf(LightpandaError)
  expect(new ProcessError('x')).not.toBeInstanceOf(TimeoutError)
})

// An app that loads the package through both import and require gets two copies.
test('instanceof works across copies of the module', async () => {
  vi.resetModules()
  const other = await import('../src/errors.js')
  expect(other.ProcessError).not.toBe(ProcessError)
  expect(new other.ProcessError('x')).toBeInstanceOf(ProcessError)
  expect(new other.ProcessError('x')).toBeInstanceOf(LightpandaError)
  expect(new other.LightpandaError('x')).not.toBeInstanceOf(ProcessError)
})
