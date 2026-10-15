import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function HydraulicPressureGraph({ masterVal = 65, height = '240px' }) {
  const chartTheme = useChartTheme()
  const factor = masterVal / 65

  const option = useMemo(() => {
    const textColor = chartTheme.textColor
    const gridColor = chartTheme.gridColor
    const tooltipBg = chartTheme.tooltipBg
    const tooltipBorder = chartTheme.tooltipBorder

    return {
      tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: textColor } },
      grid: { top: 20, right: 15, bottom: 30, left: 45 },
      xAxis: { type: 'category', data: ['10s', '8s', '6s', '4s', '2s', 'Now'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: 'PSI', min: 1000, max: 3000, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [{
        type: 'line',
        smooth: true,
        data: [2050, 2100, 2180, 2220, 2120, Number((2150 * factor).toFixed(0))],
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59, 130, 246, 0.15)' },
        markLine: { data: [{ yAxis: 2600, name: 'High Alarm (2600 PSI)', lineStyle: { color: '#ef4444', type: 'dashed' } }] }
      }]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
