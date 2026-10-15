import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function AirQualityIndexGraph({ masterVal = 65, points = [], height = '240px', title, name }) {
  const chartTheme = useChartTheme()
  const numVal = Number(masterVal) || 0
  const seriesName = name || title || ''

  const option = useMemo(() => {
    const textColor = chartTheme.textColor
    const gridColor = chartTheme.gridColor
    const legendTextColor = chartTheme.legendTextColor
    const tooltipBg = chartTheme.tooltipBg
    const tooltipBorder = chartTheme.tooltipBorder

    const xData = points && points.length > 0 ? points.map(p => p.time) : ['10s', '8s', '6s', '4s', '2s', 'Now']
    const yData = points && points.length > 0 ? points.map(p => p.value) : [
      Number((numVal * 0.95).toFixed(2)),
      Number((numVal * 0.97).toFixed(2)),
      Number((numVal * 1.02).toFixed(2)),
      Number((numVal * 0.98).toFixed(2)),
      Number((numVal * 1.01).toFixed(2)),
      Number(numVal.toFixed(2))
    ]

    return {
      tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: textColor } },
      legend: { show: false },
      grid: { top: 16, right: 15, bottom: 30, left: 40 },
      xAxis: { type: 'category', boundaryGap: false, data: xData, axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [
        {
          name: seriesName,
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: yData,
          itemStyle: { color: '#3b82f6' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.25)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.01)' }
              ]
            }
          }
        }
      ]
    }
  }, [numVal, points, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
