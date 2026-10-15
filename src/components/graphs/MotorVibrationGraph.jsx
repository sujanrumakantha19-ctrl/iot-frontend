import React, { useMemo } from 'react'
import EChart from '../shared/EChart'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function MotorVibrationGraph({ masterVal = 65, height = '240px' }) {
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
      xAxis: { type: 'category', data: ['10Hz', '50Hz', '100Hz', '250Hz', '500Hz', '1kHz'], axisLabel: { color: textColor, fontSize: 10, margin: 8 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: 'mm/s', axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
      series: [{
        type: 'bar',
        data: [0.4, 1.2, Number((4.2 * factor).toFixed(1)), 2.1, 0.9, 0.3],
        itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] }
      }]
    }
  }, [factor, chartTheme])

  return (
    <div className="w-full relative" style={{ height }}>
      <EChart option={option} className="w-full h-full" />
    </div>
  )
}
