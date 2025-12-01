import { useState, useEffect } from 'react'
import ReactApexChart from 'react-apexcharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CallMetricsChart() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const result = await window.electronAPI.api.getCallMetrics()
        if (result.success) {
          setData(result)
        } else {
          setError(result.error)
        }
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading call metrics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }

  if (!data) return null

  // Prepare chart data
  const chartOptions = {
    chart: {
      type: 'line',
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      animations: {
        enabled: true
      }
    },
    theme: {
      mode: 'dark'
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    colors: ['#4ade80'],
    grid: {
      borderColor: '#333',
      strokeDashArray: 4
    },
    xaxis: {
      categories: data.daily.map(d => d.date),
      labels: {
        style: {
          colors: '#888'
        },
        rotate: -45
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#888'
        }
      },
      title: {
        text: 'Total Calls',
        style: {
          color: '#888'
        }
      }
    },
    tooltip: {
      theme: 'dark',
      x: {
        format: 'MMM dd, yyyy'
      }
    },
    dataLabels: {
      enabled: false
    }
  }

  const series = [{
    name: 'Calls',
    data: data.daily.map(d => d.total_calls)
  }]

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardDescription className="text-xs">Total Calls</CardDescription>
            <CardTitle className="text-2xl text-green-400">{data.current.totalCalls}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardDescription className="text-xs">Conversations</CardDescription>
            <CardTitle className="text-2xl text-green-400">{data.current.conversations}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardDescription className="text-xs">Avg Duration</CardDescription>
            <CardTitle className="text-2xl text-green-400">{Math.round(data.current.avgDuration)}s</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardDescription className="text-xs">Conversation Rate</CardDescription>
            <CardTitle className="text-2xl text-green-400">{data.current.conversationRate.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Daily Calls Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Call Volume</CardTitle>
          <CardDescription>Calls over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ReactApexChart
            options={chartOptions}
            series={series}
            type="line"
            height={400}
          />
        </CardContent>
      </Card>

      {/* Call Type Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warm Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Calls</span>
                <span className="font-semibold">{data.current.warmCalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connects</span>
                <span className="font-semibold">{data.current.warmConnects}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connect Rate</span>
                <span className="font-semibold text-green-400">{data.current.warmConnectRate.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cold Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Calls</span>
                <span className="font-semibold">{data.current.coldCalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connects</span>
                <span className="font-semibold">{data.current.coldConnects}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connect Rate</span>
                <span className="font-semibold text-green-400">{data.current.coldConnectRate.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
