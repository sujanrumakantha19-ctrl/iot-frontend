export const ASSET_TWIN_REGISTRY = {
  MOTOR_2D_SIEMENS: {
    id: 'MOTOR_2D_SIEMENS',
    name: 'SIEMENS 3-Phase Induction Motor',
    description: 'Interactive 2D motor digital twin with DE/NDE bearing sensors',
    component: 'MotorDigitalTwin2D',
    slots: [
      { key: 'deVib', label: 'DE Vibration', unit: 'mm/s', required: true },
      { key: 'deTemp', label: 'DE Bearing Temp', unit: '°C', required: true },
      { key: 'ndeVib', label: 'NDE Vibration', unit: 'mm/s', required: true },
      { key: 'ndeTemp', label: 'NDE Bearing Temp', unit: '°C', required: true },
      { key: 'rpm', label: 'Motor Speed', unit: 'RPM', required: false },
      { key: 'current', label: 'Supply Current', unit: 'A', required: false }
    ]
  }
}

export const getAssetTwinTemplate = (templateId) => ASSET_TWIN_REGISTRY[templateId] || null
