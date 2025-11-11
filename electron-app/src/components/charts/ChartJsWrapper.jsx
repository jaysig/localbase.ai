import { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chart, registerables } from 'chart.js'
import { VennDiagramController, ArcSlice } from 'chartjs-chart-venn'

// Register Chart.js components
Chart.register(...registerables, VennDiagramController, ArcSlice)

// Example Chart.js Venn Diagram Component
// This demonstrates how to use chartjs-chart-venn in LocalBase
// Replace the example data (Roofr, QuickBooks) with your actual business data
export default function ChartJsWrapper() {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d')

      // Create Venn diagram data
      const datasetA = []
      for (let i = 0; i < 45; i++) datasetA.push(`a-only-${i}`)
      for (let i = 0; i < 69; i++) datasetA.push(`shared-${i}`)

      const datasetB = []
      for (let i = 0; i < 12; i++) datasetB.push(`b-only-${i}`)
      for (let i = 0; i < 69; i++) datasetB.push(`shared-${i}`)

      const rawData = [
        { label: 'Roofr Customers', values: datasetA },
        { label: 'QuickBooks Customers', values: datasetB },
      ]

      // Extract sets using chartjs-chart-venn utility
      const data = {
        labels: ['Roofr', 'QuickBooks', 'Both'],
        datasets: [{
          label: 'Customer Overlap',
          data: [
            { sets: ['Roofr'], value: 45 },
            { sets: ['QuickBooks'], value: 12 },
            { sets: ['Roofr', 'QuickBooks'], value: 69 },
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.5)',  // blue
            'rgba(16, 185, 129, 0.5)',  // green
            'rgba(245, 158, 11, 0.5)',  // orange
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)',
          ],
          borderWidth: 2,
        }]
      }

      chartInstance.current = new Chart(ctx, {
        type: 'venn',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: {
                color: '#94a3b8',
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${context.label}: ${context.parsed} customers`
                },
              },
            },
          },
        },
      })
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [])

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Chart.js + Venn Diagrams</h2>
      <p className="text-muted-foreground mb-8">
        Specialty charts with chartjs-chart-venn
      </p>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Data Overlap</CardTitle>
            <CardDescription>Roofr vs QuickBooks customer comparison</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div style={{ width: '500px', height: '400px' }}>
              <canvas ref={chartRef}></canvas>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Venn Diagram Support</CardTitle>
              <CardDescription>chartjs-chart-venn plugin</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The chartjs-chart-venn plugin works seamlessly in Electron,
                showing data overlaps and set intersections.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Insights</CardTitle>
              <CardDescription>Customer overlap analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>45</strong> customers only in Roofr</p>
                <p><strong>12</strong> customers only in QuickBooks</p>
                <p><strong>69</strong> customers in both systems</p>
                <p className="text-muted-foreground mt-4">
                  60.5% overlap rate
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
