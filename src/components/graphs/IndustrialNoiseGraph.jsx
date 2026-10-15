import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function IndustrialNoiseGraph({ masterVal = 65, height = '240px' }) {
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
      xAxis: { type: 'category', data: ['08:00', '09:00', '10:00', '11:00', '12:00', 'Now'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: 'dB', min: 50, max: 110, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [{
        type: 'line',
        data: [65, 72, 88, 94, 78, Number((74.2 * factor).toFixed(1))],
        itemStyle: { color: '#f59e0b' },
        markLine: { data: [{ yAxis: 85, name: 'OSHA Limit (85dB)', lineStyle: { color: '#ef4444', type: 'dashed' } }] }
      }]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
