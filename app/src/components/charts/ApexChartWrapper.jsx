import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ReactApexChart from 'react-apexcharts'

const chartOptions = {
  chart: {
    type: 'line',
    height: 400,
    background: 'transparent',
    toolbar: {
      show: true,
    },
    foreColor: '#94a3b8', // muted-foreground
  },
  theme: {
    mode: 'dark',
  },
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  colors: ['#3b82f6', '#10b981', '#f59e0b'],
  xaxis: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  tooltip: {
    theme: 'dark',
  },
  legend: {
    position: 'top',
  },
}

const chartSeries = [
  {
    name: 'Proposals Sent',
    data: [30, 40, 35, 50, 49, 60, 70, 91, 85, 95, 100, 110],
  },
  {
    name: 'Proposals Signed',
    data: [15, 20, 18, 25, 24, 30, 35, 45, 42, 47, 50, 55],
  },
  {
    name: 'Revenue ($k)',
    data: [45, 60, 54, 75, 73, 90, 105, 136, 127, 142, 150, 165],
  },
]

export default function ApexChartWrapper() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">ApexCharts Integration</h2>
      <p className="text-muted-foreground mb-8">
        Your existing business metrics visualizations
      </p>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Metrics - 2024</CardTitle>
            <CardDescription>Proposals and revenue tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <ReactApexChart
              options={chartOptions}
              series={chartSeries}
              type="line"
              height={400}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Complex Visualizations</CardTitle>
              <CardDescription>Multi-series support</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ApexCharts supports complex multi-line charts, dual Y-axis,
                and interactive tooltips - perfect for your existing LocalBase charts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Easy Migration</CardTitle>
              <CardDescription>Drop-in replacement</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Wrap your existing ApexCharts config with react-apexcharts
                and place inside shadcn Card components.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
