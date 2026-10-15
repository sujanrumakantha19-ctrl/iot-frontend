import { memo, useEffect, useRef } from 'react'
import * as echarts from 'echarts'

function applyZoomToOption(option, containerHeight, enableZoom) {
  if (!option || typeof option !== 'object' || enableZoom === false) return option
  // Only apply to Cartesian charts with xAxis
  if (!option.xAxis) return option

  const hasDataZoom = Array.isArray(option.dataZoom) && option.dataZoom.length > 0
  const hasInside = hasDataZoom && option.dataZoom.some(z => z.type === 'inside')
  const hasSlider = hasDataZoom && option.dataZoom.some(z => z.type === 'slider')
  const isCompact = containerHeight && containerHeight < 150

  const enhanced = { ...option }

  // 1. DataZoom (inside for mouse wheel/trackpad/touch + slider for visual scrub)
  let dataZoom = hasDataZoom ? [...option.dataZoom] : []
  if (!hasInside) {
    dataZoom.push({
      type: 'inside',
      xAxisIndex: [0],
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: true
    })
  }

  if (!hasSlider && !isCompact) {
    dataZoom.push({
      type: 'slider',
      show: true,
      xAxisIndex: [0],
      height: 16,
      bottom: 2,
      borderColor: 'rgba(203, 213, 225, 0.4)',
      fillerColor: 'rgba(59, 130, 246, 0.12)',
      handleSize: '110%',
      handleStyle: {
        color: '#3b82f6',
        borderColor: '#ffffff',
        borderWidth: 1.5
      },
      moveHandleStyle: { color: '#cbd5e1' },
      textStyle: { fontSize: 8, color: '#64748b' }
    })
  }
  enhanced.dataZoom = dataZoom

  // 2. Toolbox (Box zoom selection & reset)
  if (!enhanced.toolbox && !isCompact) {
    enhanced.toolbox = {
      show: true,
      right: 10,
      top: 2,
      itemSize: 12,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: { zoom: 'Box Zoom', back: 'Reset Zoom' }
        },
        restore: { title: 'Restore' }
      },
      iconStyle: {
        borderColor: '#94a3b8'
      }
    }
  }

  // 3. Grid bottom adjustment so slider doesn't collide with x-axis labels
  if (!isCompact && !hasSlider) {
    const existingGrid = enhanced.grid || {}
    const curBottom = typeof existingGrid.bottom === 'number' ? existingGrid.bottom : 25
    if (curBottom < 34) {
      enhanced.grid = {
        ...existingGrid,
        bottom: 34
      }
    }
  }

  return enhanced
}

function EChartInner({ option, className = 'w-full h-full', style, onChartReady, enableZoom = true }) {
  const chartRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Initialize chart instance
    const chart = echarts.init(chartRef.current)
    instanceRef.current = chart

    if (onChartReady) onChartReady(chart)

    if (option) {
      const prepared = applyZoomToOption(option, chartRef.current?.clientHeight, enableZoom)
      chart.setOption(prepared, true)
    }

    // ResizeObserver to detect container size changes (e.g. grid drag & resize)
    const resizeObserver = new ResizeObserver(() => {
      if (instanceRef.current) {
        instanceRef.current.resize()
      }
    })
    resizeObserver.observe(chartRef.current)

    // Window resize handler
    const handleResize = () => {
      if (instanceRef.current) {
        instanceRef.current.resize()
      }
    }
    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      chart.dispose()
      instanceRef.current = null
    }
  }, [])

  // Update options dynamically when they change
  useEffect(() => {
    if (instanceRef.current && option) {
      const prepared = applyZoomToOption(option, chartRef.current?.clientHeight, enableZoom)
      instanceRef.current.setOption(prepared, false)
    }
  }, [option, enableZoom])

  return <div ref={chartRef} className={className} style={style} />
}

export default memo(EChartInner)
