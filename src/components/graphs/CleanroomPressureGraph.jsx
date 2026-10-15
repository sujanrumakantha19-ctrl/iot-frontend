import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function CleanroomPressureGraph({ masterVal = 65, height = '240px' }) {
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
      xAxis: { type: 'category', data: ['08:00', '10:00', '12:00', '14:00', '16:00', 'Now'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: 'Pa', min: 0, max: 40, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [{
        type: 'line',
        smooth: true,
        data: [22.0, 23.5, 25.1, 24.8, 23.9, Number((24.5 * factor).toFixed(1))],
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.15)' }
      }]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
