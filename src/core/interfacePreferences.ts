import { useEffect, useState } from 'react'

export const INTERFACE_KEY = 'clyvora-convert-interface-v1'
export const interfaceDefaults = { reduceMotion: false, reduceTransparency: false, autoOpenQueue: true, autoDownload: true, showHelp: false }
export type InterfacePreferences = typeof interfaceDefaults
export function readInterfacePreferences(): InterfacePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(INTERFACE_KEY) || '{}')
    return Object.fromEntries(Object.entries(interfaceDefaults).map(([key, fallback]) => [key, typeof value?.[key] === 'boolean' ? value[key] : fallback])) as InterfacePreferences
  } catch { return { ...interfaceDefaults } }
}
export function saveInterfacePreferences(value: InterfacePreferences) {
  try { localStorage.setItem(INTERFACE_KEY, JSON.stringify(value)) } catch { /* Optional preferences. */ }
  window.dispatchEvent(new Event('convert-interface-change'))
}
export function useInterfacePreferences() {
  const [value, setValue] = useState(readInterfacePreferences)
  useEffect(() => {
    const changed = () => setValue(readInterfacePreferences())
    window.addEventListener('convert-interface-change', changed)
    window.addEventListener('storage', changed)
    return () => { window.removeEventListener('convert-interface-change', changed); window.removeEventListener('storage', changed) }
  }, [])
  return [value, (patch: Partial<InterfacePreferences>) => saveInterfacePreferences({ ...readInterfacePreferences(), ...patch })] as const
}
