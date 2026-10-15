import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function ColdChainTempGraph({ masterVal = 65, height = '240px' }) {
  const chartTheme = useChartTheme()
  const factor = masterVal / 65

  const option = useMemo(() => {
    const textColor = chartTheme.textColor
    const gridColor = chartTheme.gridColor
    const tooltipBg = chartTheme.tooltipBg
    const tooltipBorder = chartTheme.tooltipBorder

    return {
      tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: textColor } },
      grid: { top: 20, right: 15, bottom: 30, left: 40 },
      xAxis: { type: 'category', data: ['12:00', '13:00', '14:00', '15:00', '16:00', 'Now'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: '°C', min: -25, max: -10, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [{
        type: 'line',
        data: [-19.2, -18.8, -18.4, -19.0, -18.6, Number((-18.5 + (1 - factor) * 2).toFixed(1))],
        itemStyle: { color: '#3b82f6' },
        markLine: { data: [{ yAxis: -15, name: 'Alarm (-15°C)', lineStyle: { color: '#ef4444', type: 'dashed' } }] }
      }]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
