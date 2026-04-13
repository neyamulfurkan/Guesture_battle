'use client'

import { GameSettings } from '@/types/game'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: GameSettings
  onSettingsChange: (settings: GameSettings) => void
}

interface ToggleProps {
  value: boolean
  onChange: (val: boolean) => void
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onChange(!value) }}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 9999,
        backgroundColor: value ? '#3b82f6' : '#1a2035',
        border: `1px solid ${value ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
        cursor: 'pointer',
        transition: 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        boxShadow: value ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 9999,
          backgroundColor: '#ffffff',
          transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}

interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 56,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }: SettingsPanelProps) {
  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    onSettingsChange({ ...settings, [key]: value })
  }

  const sensitivities: Array<{ label: string; value: GameSettings['gestureSensitivity'] }> = [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
  ]

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Settings">
      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Gesture Sensitivity */}
        <SettingRow
          label="Gesture Sensitivity"
          description="How responsive gesture detection is to your movements"
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {sensitivities.map(({ label, value }) => (
              <Button
                key={value}
                variant={settings.gestureSensitivity === value ? 'primary' : 'secondary'}
                accentColor={settings.gestureSensitivity === value ? 'blue' : 'gray'}
                size="sm"
                onClick={() => update('gestureSensitivity', value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </SettingRow>

        {/* Voice Detection */}
        <SettingRow
          label="Voice Detection"
          description="Enables voice command powers (FIRE, NOW, ULTIMATE…)"
        >
          <Toggle
            value={settings.voiceDetection}
            onChange={val => update('voiceDetection', val)}
          />
        </SettingRow>

        {/* Face Expressions */}
        <SettingRow
          label="Face Expressions"
          description="Detects facial expressions for bonus effects"
        >
          <Toggle
            value={settings.faceExpressions}
            onChange={val => update('faceExpressions', val)}
          />
        </SettingRow>

        {/* SFX Volume */}
        <SettingRow
          label="Sound Effects Volume"
          description={`${settings.sfxVolume}%`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 20, textAlign: 'right' }}>0</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.sfxVolume}
              onChange={e => update('sfxVolume', Number(e.target.value))}
              style={{
                width: 100,
                accentColor: '#3b82f6',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 24 }}>100</span>
          </div>
        </SettingRow>

        {/* Show Hand Skeleton */}
        <SettingRow
          label="Show Hand Skeleton"
          description="Displays landmark dots and bone lines over your hand"
        >
          <Toggle
            value={settings.showHandSkeleton}
            onChange={val => update('showHandSkeleton', val)}
          />
        </SettingRow>

        {/* Show Power Tooltips */}
        <SettingRow
          label="Show Power Tooltips"
          description="Displays gesture and cooldown details when hovering a power"
        >
          <Toggle
            value={settings.showPowerTooltips}
            onChange={val => update('showPowerTooltips', val)}
          />
        </SettingRow>

        {/* Gesture Navigation */}
        <SettingRow
          label="Gesture Navigation"
          description="Use hand gestures to interact with menus and buttons"
        >
          <Toggle
            value={settings.gestureNavigation}
            onChange={val => update('gestureNavigation', val)}
          />
        </SettingRow>

        {/* Accessibility Touch Controls */}
        <SettingRow
          label="Touch Controls"
          description="Show tap buttons for all powers as an accessibility fallback"
        >
          <Toggle
            value={settings.touchControls}
            onChange={val => update('touchControls', val)}
          />
        </SettingRow>

      </div>
    </Drawer>
  )
}