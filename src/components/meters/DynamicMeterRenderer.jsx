import React from 'react'

// Digital & LED Segmented Meters (Group 1 - 10 Meters)
import MiniGaugeMeter from './MiniGaugeMeter'
import DigitalThermometer360Meter from './DigitalThermometer360Meter'
import DigitalSpeedometerArcMeter from './DigitalSpeedometerArcMeter'
import DigitalVerticalBarMeter from './DigitalVerticalBarMeter'
import DigitalHorizontalBarMeter from './DigitalHorizontalBarMeter'
import SimpleNeonGaugeMeter from './SimpleNeonGaugeMeter'
import NeonGaugeArcMeter from './NeonGaugeArcMeter'
import LcdGaugeArcMeter from './LcdGaugeArcMeter'
import CyberpunkHexGaugeMeter from './CyberpunkHexGaugeMeter'
import SciFiEnergyCoreMeter from './SciFiEnergyCoreMeter'
import VerticalBarWithIdleMeter from './VerticalBarWithIdleMeter'
import VerticalBarNormalMeter from './VerticalBarNormalMeter'

// Analogue Gauge Meters (Group 2 - 10 Meters)
import AnalogueTemperatureGaugeMeter from './AnalogueTemperatureGaugeMeter'
import AnalogueThermometerScaleMeter from './AnalogueThermometerScaleMeter'
import AnalogueSpeedGaugeMeter from './AnalogueSpeedGaugeMeter'
import AnalogueRadialGaugeMeter from './AnalogueRadialGaugeMeter'
import AnalogueCompassMeter from './AnalogueCompassMeter'
import RetroVUMeter from './RetroVUMeter'
import SubmarineDepthGaugeMeter from './SubmarineDepthGaugeMeter'
import BatteryLevelMeter from './BatteryLevelMeter'
import LinearThermometerVerticalMeter from './LinearThermometerVerticalMeter'
import AircraftAltimeterMeter from './AircraftAltimeterMeter'

export const METER_REGISTRY = {
  // --- Group 1: Digital & LED Segmented Meters (10 Meters) ---
  MINI_GAUGE: {
    id: 'MINI_GAUGE',
    name: 'Mini gauge',
    category: 'Digital / LED',
    group: 'digital',
    component: MiniGaugeMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Mini gauge' }
  },
  DIGITAL_THERMOMETER_360: {
    id: 'DIGITAL_THERMOMETER_360',
    name: 'Digital thermometer',
    category: 'Digital / LED',
    group: 'digital',
    component: DigitalThermometer360Meter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Digital thermometer' }
  },
  DIGITAL_SPEEDOMETER_ARC: {
    id: 'DIGITAL_SPEEDOMETER_ARC',
    name: 'Digital speedometer',
    category: 'Digital / LED',
    group: 'digital',
    component: DigitalSpeedometerArcMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Digital speedometer' }
  },
  DIGITAL_VERTICAL_BAR: {
    id: 'DIGITAL_VERTICAL_BAR',
    name: 'Digital vertical bar',
    category: 'Digital / LED',
    group: 'digital',
    component: DigitalVerticalBarMeter,
    defaultProps: { min: -60, max: 60, unit: '', label: 'Digital vertical bar' }
  },
  DIGITAL_HORIZONTAL_BAR: {
    id: 'DIGITAL_HORIZONTAL_BAR',
    name: 'Digital horizontal bar',
    category: 'Digital / LED',
    group: 'digital',
    component: DigitalHorizontalBarMeter,
    defaultProps: { min: 0, max: 180, unit: '', label: 'Digital horizontal bar' }
  },
  SIMPLE_NEON_GAUGE: {
    id: 'SIMPLE_NEON_GAUGE',
    name: 'Simple neon gauge',
    category: 'Digital / LED',
    group: 'digital',
    component: SimpleNeonGaugeMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Simple neon gauge' }
  },
  NEON_GAUGE_ARC: {
    id: 'NEON_GAUGE_ARC',
    name: 'Neon gauge',
    category: 'Digital / LED',
    group: 'digital',
    component: NeonGaugeArcMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Neon gauge' }
  },
  LCD_GAUGE_ARC: {
    id: 'LCD_GAUGE_ARC',
    name: 'LCD gauge',
    category: 'Digital / LED',
    group: 'digital',
    component: LcdGaugeArcMeter,
    defaultProps: { min: 0, max: 180, unit: '', label: 'LCD gauge' }
  },
  CYBERPUNK_HEX: {
    id: 'CYBERPUNK_HEX',
    name: 'Cyberpunk Hex Core',
    category: 'Digital / LED',
    group: 'digital',
    component: CyberpunkHexGaugeMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Cyberpunk Hex Core' }
  },
  SCIFI_ENERGY_CORE: {
    id: 'SCIFI_ENERGY_CORE',
    name: 'Sci-Fi Plasma Core',
    category: 'Digital / LED',
    group: 'digital',
    component: SciFiEnergyCoreMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Plasma Reactor Core' }
  },
  VERTICAL_BAR_IDLE: {
    id: 'VERTICAL_BAR_IDLE',
    name: 'Vertical Bar (Min / Max / Idle)',
    category: 'Digital / LED',
    group: 'digital',
    component: VerticalBarWithIdleMeter,
    defaultProps: { min: -140, max: 140, idle: 0, unit: '', label: 'Vertical Bar (Idle Baseline)' }
  },
  VERTICAL_BAR_NORMAL: {
    id: 'VERTICAL_BAR_NORMAL',
    name: 'Vertical Bar (Min / Max)',
    category: 'Digital / LED',
    group: 'digital',
    component: VerticalBarNormalMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Vertical Bar (Normal Fill)' }
  },

  // --- Group 2: Analogue & Mechanical Gauges (10 Meters) ---
  ANALOGUE_TEMP_GAUGE: {
    id: 'ANALOGUE_TEMP_GAUGE',
    name: 'Temperature radial gauge',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AnalogueTemperatureGaugeMeter,
    defaultProps: { min: -60, max: 60, unit: '', label: 'Temperature radial gauge' }
  },
  ANALOGUE_THERMOMETER_SCALE: {
    id: 'ANALOGUE_THERMOMETER_SCALE',
    name: 'Thermometer scale',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AnalogueThermometerScaleMeter,
    defaultProps: { min: -60, max: 100, unit: '', label: 'Thermometer scale' }
  },
  ANALOGUE_SPEED_GAUGE: {
    id: 'ANALOGUE_SPEED_GAUGE',
    name: 'Speed gauge',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AnalogueSpeedGaugeMeter,
    defaultProps: { min: 0, max: 180, unit: '', label: 'Speed gauge' }
  },
  ANALOGUE_RADIAL_GAUGE: {
    id: 'ANALOGUE_RADIAL_GAUGE',
    name: 'Radial gauge',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AnalogueRadialGaugeMeter,
    defaultProps: { min: -100, max: 100, unit: '', label: 'Radial gauge' }
  },
  ANALOGUE_COMPASS: {
    id: 'ANALOGUE_COMPASS',
    name: 'Compass',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AnalogueCompassMeter,
    defaultProps: { label: 'Compass' }
  },
  RETRO_VU_METER: {
    id: 'RETRO_VU_METER',
    name: 'Vintage Stereo VU Meter',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: RetroVUMeter,
    defaultProps: { min: -20, max: 3, unit: '', label: 'Vintage VU Meter' }
  },
  SUBMARINE_DEPTH: {
    id: 'SUBMARINE_DEPTH',
    name: 'Submarine Depth Gauge',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: SubmarineDepthGaugeMeter,
    defaultProps: { min: 0, max: 600, unit: '', label: 'Submarine Depth Gauge' }
  },
  BATTERY_LEVEL: {
    id: 'BATTERY_LEVEL',
    name: 'Battery Power Cell',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: BatteryLevelMeter,
    defaultProps: { min: 0, max: 100, unit: '', label: 'Battery Power Cell' }
  },
  LINEAR_THERMOMETER_V: {
    id: 'LINEAR_THERMOMETER_V',
    name: 'Vertical Glass Thermometer',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: LinearThermometerVerticalMeter,
    defaultProps: { min: -20, max: 100, unit: '', label: 'Vertical Glass Thermometer' }
  },
  AIRCRAFT_ALTIMETER: {
    id: 'AIRCRAFT_ALTIMETER',
    name: 'Aircraft Cockpit Altimeter',
    category: 'Analogue Gauge',
    group: 'analogue',
    component: AircraftAltimeterMeter,
    defaultProps: { min: 0, max: 10000, unit: '', label: 'Aircraft Altimeter' }
  }
}

export default function DynamicMeterRenderer({ type = 'MINI_GAUGE', value = 50, customProps = {}, unit, ...rest }) {
  const meterDef = METER_REGISTRY[type] || METER_REGISTRY.MINI_GAUGE
  const MeterComp = meterDef.component

  // Prioritize explicitly provided unit (prop or customProps.unit)
  const resolvedUnit = unit !== undefined && unit !== null
    ? unit
    : (customProps.unit !== undefined && customProps.unit !== null
        ? customProps.unit
        : (meterDef.defaultProps?.unit || ''))

  const props = {
    ...meterDef.defaultProps,
    ...customProps,
    ...rest,
    value,
    unit: resolvedUnit
  }

  return <MeterComp {...props} />
}
