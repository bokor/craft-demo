import React from 'react'
import { Row, Col, Card } from 'react-bootstrap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type TimePeriod = 'day' | 'week' | 'month'

interface ChartDataPoint {
  period: string
  total: number | null
  forecast?: number
}

interface SalesTrendChartProps {
  timePeriod: TimePeriod
  chartData: ChartDataPoint[]
  hasForecastData: boolean
  formatCurrency: (amount: number) => string
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  timePeriod,
  chartData,
  hasForecastData,
  formatCurrency
}) => {
  const getPeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case 'day': return 'Daily'
      case 'week': return 'Weekly'
      case 'month': return 'Monthly'
    }
  }

  const chartTooltipFormatter = (value: number) => [formatCurrency(value), 'Total Sales']

  return (
    <Row className="mb-4">
      <Col>
        <Card>
          <Card.Body>
            <h5>{getPeriodLabel(timePeriod)} Sales Trend</h5>
            {hasForecastData && (
              <div className="mb-2">
                <small className="text-muted">
                  Forecast data available for {getPeriodLabel(timePeriod)} period.
                </small>
              </div>
            )}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ left: 80, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={chartTooltipFormatter} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#8884d8" name="Actual Sales" />
                {hasForecastData && (
                  <Line type="monotone" dataKey="forecast" stroke="#ff7300" strokeDasharray="5 5" name="Forecast" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  )
}