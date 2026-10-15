import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function GridFeedInImportGraph({ masterVal = 65, height = '240px' }) {
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
      legend: { data: ['Export (kW)', 'Import (kW)'], textStyle: { color: legendTextColor, fontSize: 10 }, top: 0, right: 0 },
      grid: { top: 32, right: 15, bottom: 30, left: 45 },
      xAxis: { type: 'category', data: ['10:00', '12:00', '14:00', '16:00'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [
        { name: 'Export (kW)', type: 'bar', data: [250, 480, 410, Number((380 * factor).toFixed(0))], itemStyle: { color: '#10b981' } },
        { name: 'Import (kW)', type: 'bar', data: [-120, -20, -50, -110], itemStyle: { color: '#ef4444' } }
      ]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
