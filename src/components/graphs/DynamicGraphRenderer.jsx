import React from 'react'

// --- Group 1: Electrical & Power (5 Graphs) ---
import Electrical3PhaseGraph from './Electrical3PhaseGraph'
import TransformerThermalGraph from './TransformerThermalGraph'
import PowerFactorGraph from './PowerFactorGraph'
import EnergyConsumptionGraph from './EnergyConsumptionGraph'
import TotalHarmonicDistortionGraph from './TotalHarmonicDistortionGraph'

// --- Group 2: Environment & Climate (5 Graphs) ---
import AirQualityIndexGraph from './AirQualityIndexGraph'
import CleanroomPressureGraph from './CleanroomPressureGraph'
import HvacTempHumidityGraph from './HvacTempHumidityGraph'
import WaterTankCapacityGraph from './WaterTankCapacityGraph'
import IndustrialNoiseGraph from './IndustrialNoiseGraph'

// --- Group 3: Machinery & Telemetry (5 Graphs) ---
import MqttTelemetryThroughputGraph from './MqttTelemetryThroughputGraph'
import MotorVibrationGraph from './MotorVibrationGraph'
import HydraulicPressureGraph from './HydraulicPressureGraph'
import OeeBreakdownGraph from './OeeBreakdownGraph'
import MachineOperatingStateGraph from './MachineOperatingStateGraph'

// --- Group 4: Solar & Microgrid (5 Graphs) ---
import SolarPvArrayGraph from './SolarPvArrayGraph'
import BatterySocGraph from './BatterySocGraph'
import GeneratorFuelLoadGraph from './GeneratorFuelLoadGraph'
import GridFeedInImportGraph from './GridFeedInImportGraph'
import EvChargingStationGraph from './EvChargingStationGraph'

// --- Group 5: Smart Sensors (5 Graphs) ---
import SubterraneanSoilMoistureGraph from './SubterraneanSoilMoistureGraph'
import GasPipelinePressureGraph from './GasPipelinePressureGraph'
import ColdChainTempGraph from './ColdChainTempGraph'
import ChemicalTankPhGraph from './ChemicalTankPhGraph'
import WeatherWindVectorGraph from './WeatherWindVectorGraph'

export const GRAPH_REGISTRY = {
  // --- 1. ELECTRICAL & POWER METERS ---
  g1: {
    id: 'g1',
    title: '3-Phase Electrical Analyser (V / A)',
    category: 'power',
    categoryLabel: 'Electrical & Power',
    tag: 'MODBUS / RS485 • PM-5000',
    getValueStr: (factor) => `${(415 * (0.98 + (factor * 0.04))).toFixed(1)} V`,
    description: 'Real-time 3-phase voltage stability (Phase A, B, C) & load current monitoring',
    component: Electrical3PhaseGraph
  },
  g2: {
    id: 'g2',
    title: 'Transformer Thermal Map & Load Factor',
    category: 'power',
    categoryLabel: 'Electrical & Power',
    tag: 'TEMPERATURE & LOAD • TR-100',
    getValueStr: (factor) => `${(62 * factor).toFixed(1)} °C`,
    description: 'Dual-axis curve correlating transformer oil winding temperature (°C) against load %',
    component: TransformerThermalGraph
  },
  g3: {
    id: 'g3',
    title: 'Power Factor & Reactive KVAR Spectrum',
    category: 'power',
    categoryLabel: 'Electrical & Power',
    tag: 'POWER QUALITY • PF-90',
    getValueStr: (factor) => `${(0.96 * Math.min(factor, 1.02)).toFixed(2)} PF`,
    description: 'Time-series line chart tracking active power factor vs 0.90 penalty threshold markline',
    component: PowerFactorGraph
  },
  g4: {
    id: 'g4',
    title: 'Energy Consumption & Peak Load Profile',
    category: 'power',
    categoryLabel: 'Electrical & Power',
    tag: 'MAIN FEEDER • KWH-800',
    getValueStr: (factor) => `${(1450 * factor).toFixed(0)} kWh`,
    description: 'High-resolution area spline chart measuring total kWh consumption and peak demand',
    component: EnergyConsumptionGraph
  },
  g5: {
    id: 'g5',
    title: 'Total Harmonic Distortion (THD %)',
    category: 'power',
    categoryLabel: 'Electrical & Power',
    tag: 'HARMONIC ANALYSER • THD-10',
    getValueStr: (factor) => `${(4.8 * factor).toFixed(1)} %`,
    description: 'Harmonic frequency spectrum (1st to 13th harmonic) with IEEE 519 warning line',
    component: TotalHarmonicDistortionGraph
  },

  // --- 2. ENVIRONMENT & CLIMATE SENSORS ---
  g6: {
    id: 'g6',
    title: 'Air Quality Index & Particle Count',
    category: 'environment',
    categoryLabel: 'Environment & Climate',
    tag: 'CLEANROOM • AQI-SENSOR',
    getValueStr: (factor) => `${(42 * factor).toFixed(0)} AQI`,
    description: 'Stacked area streamgraph monitoring PM2.5, PM10, CO2 ppm, and VOC levels',
    component: AirQualityIndexGraph
  },
  g7: {
    id: 'g7',
    title: 'Cleanroom Differential Pressure (Pa)',
    category: 'environment',
    categoryLabel: 'Environment & Climate',
    tag: 'PRESSURE TRANSMITTER • DP-200',
    getValueStr: (factor) => `${(24.5 * factor).toFixed(1)} Pa`,
    description: 'Time-series line chart tracking positive room air pressure differential against 20-30 Pa range',
    component: CleanroomPressureGraph
  },
  g8: {
    id: 'g8',
    title: 'HVAC Temperature & Relative Humidity',
    category: 'environment',
    categoryLabel: 'Environment & Climate',
    tag: 'HVAC SMART TRANSMITTER',
    getValueStr: (factor) => `${(23.4 * (0.95 + factor * 0.05)).toFixed(1)} °C`,
    description: 'Dual-axis climate graph for server room and cleanroom environmental stability',
    component: HvacTempHumidityGraph
  },
  g9: {
    id: 'g9',
    title: 'Water & Storage Tank Capacity Hydrograph',
    category: 'environment',
    categoryLabel: 'Environment & Climate',
    tag: 'ULTRASONIC LEVEL • LT-50',
    getValueStr: (factor) => `${(78.5 * Math.min(factor, 1.15)).toFixed(1)} %`,
    description: 'Reservoir storage fill capacity trend line & volume hydrograph over time',
    component: WaterTankCapacityGraph
  },
  g10: {
    id: 'g10',
    title: 'Industrial Noise & Acoustic Level (dB)',
    category: 'environment',
    categoryLabel: 'Environment & Climate',
    tag: 'ACOUSTIC SENSOR • dB-88',
    getValueStr: (factor) => `${(74.2 * factor).toFixed(1)} dB`,
    description: 'Factory floor acoustic decibel level plot vs OSHA 85dB safety limit',
    component: IndustrialNoiseGraph
  },

  // --- 3. MACHINERY & TELEMETRY ---
  g11: {
    id: 'g11',
    title: 'MQTT Telemetry Packet Throughput',
    category: 'machinery',
    categoryLabel: 'Machinery & Telemetry',
    tag: 'MQTT BROKER INGESTION',
    getValueStr: (factor) => `${(1850 * factor).toFixed(0)} pkts/s`,
    description: 'High-frequency streaming spline curve displaying live message ingestion rate',
    component: MqttTelemetryThroughputGraph
  },
  g12: {
    id: 'g12',
    title: 'Motor Bearing Vibration Spectrum (FFT)',
    category: 'machinery',
    categoryLabel: 'Machinery & Telemetry',
    tag: 'PIEZO ACCELEROMETER • VIB-10',
    getValueStr: (factor) => `${(4.2 * factor).toFixed(1)} mm/s`,
    description: 'Frequency spectrum analysis (Hz) detecting early bearing unbalance & wear',
    component: MotorVibrationGraph
  },
  g13: {
    id: 'g13',
    title: 'Hydraulic Oil Pressure Waveform (PSI)',
    category: 'machinery',
    categoryLabel: 'Machinery & Telemetry',
    tag: 'HYDRAULIC MANIFOLD • HYD-300',
    getValueStr: (factor) => `${(2150 * factor).toFixed(0)} PSI`,
    description: 'Heavy-duty hydraulic pressure waveform graph with upper limit redline boundaries',
    component: HydraulicPressureGraph
  },
  g14: {
    id: 'g14',
    title: 'Overall Equipment Effectiveness Breakdown',
    category: 'machinery',
    categoryLabel: 'Machinery & Telemetry',
    tag: 'SMART FACTORY OEE ENGINE',
    getValueStr: (factor) => `${(86.4 * Math.min(factor, 1.1)).toFixed(1)} % OEE`,
    description: 'Stacked column chart evaluating Availability (88%), Performance (92%), and Quality (98%)',
    component: OeeBreakdownGraph
  },
  g15: {
    id: 'g15',
    title: 'Machine Operating State Timeline',
    category: 'machinery',
    categoryLabel: 'Machinery & Telemetry',
    tag: 'PLC LOGIC MONITOR',
    getValueStr: () => 'RUNNING (92%)',
    description: 'State duration bar tracking Running, Idle, Fault, and Maintenance states',
    component: MachineOperatingStateGraph
  },

  // --- 4. SOLAR & ENERGY STORAGE ---
  g16: {
    id: 'g16',
    title: 'Solar PV Array Generation Output (kW)',
    category: 'solar',
    categoryLabel: 'Solar & Microgrid',
    tag: 'SOLAR INVERTER • PV-120KW',
    getValueStr: (factor) => `${(84.5 * factor).toFixed(1)} kW`,
    description: 'Solar irradiance vs actual PV generation output power curve across daylight hours',
    component: SolarPvArrayGraph
  },
  g17: {
    id: 'g17',
    title: 'Battery Storage State of Charge (SOC %)',
    category: 'solar',
    categoryLabel: 'Solar & Microgrid',
    tag: 'BESS MANAGEMENT • BATT-500',
    getValueStr: (factor) => `${(92 * Math.min(factor, 1.05)).toFixed(0)} %`,
    description: 'Dual-axis curve monitoring battery SOC (%) and charge/discharge current (A)',
    component: BatterySocGraph
  },
  g18: {
    id: 'g18',
    title: 'Generator Fuel vs Electrical Load',
    category: 'solar',
    categoryLabel: 'Solar & Microgrid',
    tag: 'DIESEL GENSET • GEN-250',
    getValueStr: (factor) => `${(42.5 * factor).toFixed(1)} L/h`,
    description: 'Fuel consumption rate (Liters/hr) vs active kilowatt electrical generation',
    component: GeneratorFuelLoadGraph
  },
  g19: {
    id: 'g19',
    title: 'Grid Feed-in vs Import Power Balance',
    category: 'solar',
    categoryLabel: 'Solar & Microgrid',
    tag: 'NET METERING SMART COUNTER',
    getValueStr: (factor) => `EXPORT: ${(380 * factor).toFixed(0)} kW`,
    description: 'Bi-directional inverted bar chart tracking solar grid feed-in export vs grid import',
    component: GridFeedInImportGraph
  },
  g20: {
    id: 'g20',
    title: 'EV Charging Hub Station Profile',
    category: 'solar',
    categoryLabel: 'Solar & Microgrid',
    tag: 'FAST DC CHARGER ARRAY',
    getValueStr: (factor) => `${(180 * factor).toFixed(0)} kW Active`,
    description: 'Kilowatt load curve and active EV charging session count across 8 station ports',
    component: EvChargingStationGraph
  },

  // --- 5. SMART SENSORS & INDUSTRIAL FLOW ---
  g21: {
    id: 'g21',
    title: 'Subterranean Soil Moisture Profile',
    category: 'sensors',
    categoryLabel: 'Smart Sensors',
    tag: 'AGRI-IOT SENSOR ARRAY',
    getValueStr: (factor) => `${(36 * factor).toFixed(1)} %`,
    description: 'Step-line graph monitoring subterranean soil humidity at 10cm, 30cm, 60cm depths',
    component: SubterraneanSoilMoistureGraph
  },
  g22: {
    id: 'g22',
    title: 'Gas Pipeline Pressure & Flow Hydrograph',
    category: 'sensors',
    categoryLabel: 'Smart Sensors',
    tag: 'NATURAL GAS TRANSMITTER',
    getValueStr: (factor) => `${(14.2 * factor).toFixed(1)} Bar`,
    description: 'Gas flow rate (m³/hr) vs differential line pressure (Bar) in main distribution pipe',
    component: GasPipelinePressureGraph
  },
  g23: {
    id: 'g23',
    title: 'Cold Chain Storage Temp Log',
    category: 'sensors',
    categoryLabel: 'Smart Sensors',
    tag: 'PHARMA REFRIGERATION',
    getValueStr: (factor) => `${(-18.5 + (1 - factor) * 2).toFixed(1)} °C`,
    description: 'Ultra-low temperature storage log with high-temp threshold breach alerts',
    component: ColdChainTempGraph
  },
  g24: {
    id: 'g24',
    title: 'Chemical Tank pH & Conductivity',
    category: 'sensors',
    categoryLabel: 'Smart Sensors',
    tag: 'ELECTROCHEMICAL ANALYSER',
    getValueStr: (factor) => `${(7.2 * (0.98 + factor * 0.04)).toFixed(1)} pH`,
    description: 'Dual-axis electrochemical plot tracking fluid pH neutralization and conductivity (µS/cm)',
    component: ChemicalTankPhGraph
  },
  g25: {
    id: 'g25',
    title: 'Weather Station Wind Vector',
    category: 'sensors',
    categoryLabel: 'Smart Sensors',
    tag: 'ULTRASONIC ANEMOMETER',
    getValueStr: (factor) => `${(18.4 * factor).toFixed(1)} km/h`,
    description: 'Time-series line chart tracking wind velocity (km/h) and peak gust vectors',
    component: WeatherWindVectorGraph
  }
}

export default function DynamicGraphRenderer({ type = 'g1', masterVal = 65, height, customProps = {} }) {
  const graphDef = GRAPH_REGISTRY[type] || GRAPH_REGISTRY.g1
  const GraphComp = graphDef.component
  return <GraphComp masterVal={masterVal} height={height} {...customProps} />
}
