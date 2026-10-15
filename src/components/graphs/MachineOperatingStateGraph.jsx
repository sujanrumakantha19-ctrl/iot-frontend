import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function MachineOperatingStateGraph({ masterVal = 65, height = '240px' }) {
  const chartTheme = useChartTheme()

  const option = useMemo(() => {
    const textColor = chartTheme.textColor
    const gridColor = chartTheme.gridColor
    const legendTextColor = chartTheme.legendTextColor
    const tooltipBg = chartTheme.tooltipBg
    const tooltipBorder = chartTheme.tooltipBorder

    return {
      tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: textColor } },
      legend: { data: ['Running', 'Idle', 'Fault'], textStyle: { color: legendTextColor, fontSize: 10 }, top: 0, right: 0 },
      grid: { top: 32, right: 15, bottom: 30, left: 60 },
      xAxis: { type: 'category', data: ['08:00', '10:00', '12:00', '14:00', '16:00'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'category', data: ['CNC M-1', 'CNC M-2', 'Robo Arm'], axisLabel: { color: textColor, fontSize: 10 } },
      series: [
        { name: 'Running', type: 'bar', stack: 'state', data: [120, 110, 95], itemStyle: { color: '#10b981' } },
        { name: 'Idle', type: 'bar', stack: 'state', data: [20, 15, 30], itemStyle: { color: '#f59e0b' } },
        { name: 'Fault', type: 'bar', stack: 'state', data: [5, 0, 15], itemStyle: { color: '#ef4444' } }
      ]
    }
  }, [chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
