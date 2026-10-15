import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function OeeBreakdownGraph({ masterVal = 65, height = '240px' }) {
  const chartTheme = useChartTheme()
  const factor = masterVal / 65

  const option = useMemo(() => {
    const textColor = chartTheme.textColor
    const gridColor = chartTheme.gridColor
    const legendTextColor = chartTheme.legendTextColor
    const tooltipBg = chartTheme.tooltipBg
    const tooltipBorder = chartTheme.tooltipBorder

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: textColor } },
      legend: { data: ['Availability', 'Performance', 'Quality'], textStyle: { color: legendTextColor, fontSize: 10 }, top: 0, right: 0 },
      grid: { top: 32, right: 15, bottom: 30, left: 40 },
      xAxis: { type: 'category', data: ['Shift 1', 'Shift 2', 'Shift 3', 'Current'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [
        { name: 'Availability', type: 'bar', data: [90, 85, 88, Number((88 * Math.min(factor, 1.1)).toFixed(0))], itemStyle: { color: '#3b82f6' } },
        { name: 'Performance', type: 'bar', data: [94, 90, 92, Number((92 * Math.min(factor, 1.1)).toFixed(0))], itemStyle: { color: '#10b981' } },
        { name: 'Quality', type: 'bar', data: [98, 97, 98, Number((98 * Math.min(factor, 1.1)).toFixed(0))], itemStyle: { color: '#8b5cf6' } }
      ]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
