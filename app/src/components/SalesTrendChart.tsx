import React from 'react'
import { Row, Col, Card } from 'react-bootstrap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../utils/formatters'

type TimePeriod = 'day' | 'week' | 'month'

interface CategoryTotal {
  category_name: string
  total_amount: number
}

interface SalesData {
  [date: string]: CategoryTotal[]
}

interface ForecastData {
  period: string
  total: number
}

interface ChartDataPoint {
  period: string
  total: number | null
  forecast?: number
}

interface ForecastResponse {
  forecast: ForecastData[]
  timePeriod: string
  message: string
  rawResponse?: string
}

interface SalesTrendChartProps {
  timePeriod: TimePeriod
  salesData: SalesData
  forecastCache: Record<string, ForecastResponse>
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  timePeriod,
  salesData,
  forecastCache
}) => {
  // Group data by time period
  const groupDataByPeriod = (data: SalesData, period: TimePeriod) => {
    const groupedData: { [key: string]: number } = {}

    Object.entries(data).forEach(([dateStr, categories]) => {
      const date = new Date(dateStr)
      let periodKey = ''

      switch (period) {
        case 'day':
          periodKey = date.toISOString().split('T')[0] // YYYY-MM-DD
          break
        case 'week': {
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
          periodKey = weekStart.toISOString().split('T')[0]
          break
        }
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
          break
      }

      // Calculate total sales for this period
      const periodTotal = categories.reduce((sum, category) => sum + category.total_amount, 0)

      if (groupedData[periodKey]) {
        groupedData[periodKey] += periodTotal
      } else {
        groupedData[periodKey] = periodTotal
      }
    })

    return groupedData
  }

  // Prepare time series data (actual sales only)
  const prepareTimeSeriesData = () => {
    const groupedData = groupDataByPeriod(salesData, timePeriod)

    return Object.entries(groupedData)
      .map(([period, total]) => ({
        period,
        total: Math.round(total * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => {
        if (timePeriod === 'month') return a.period.localeCompare(b.period)
        return new Date(a.period).getTime() - new Date(b.period).getTime()
      })
  }

  // Combine actual and forecast data for the chart
  const prepareCombinedChartData = (): ChartDataPoint[] => {
    const actualData = prepareTimeSeriesData()

    // Get forecast data from cache for current time period
    const forecastData = forecastCache[timePeriod]

    if (!forecastData) {
      return actualData.map(point => ({
        period: point.period,
        total: point.total
      }))
    }

    // Get forecast data from the response
    const forecastArray: ForecastData[] = forecastData.forecast || []

    if (forecastArray.length === 0) {
      return actualData.map(point => ({
        period: point.period,
        total: point.total
      }))
    }

    // Combine the data, ensuring forecast starts after actual data ends
    const combinedData: ChartDataPoint[] = actualData.map(point => ({
      period: point.period,
      total: point.total
    }))

    // Add forecast data with null actual values and actual forecast values
    forecastArray.forEach(forecastPoint => {
      combinedData.push({
        period: forecastPoint.period,
        total: null, // This will be the actual sales line (null for forecast periods)
        forecast: forecastPoint.total // This will be the forecast line
      })
    })

    return combinedData.sort((a, b) => {
      if (timePeriod === 'month') return a.period.localeCompare(b.period)
      return new Date(a.period).getTime() - new Date(b.period).getTime()
    })
  }

  const getPeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case 'day': return 'Daily'
      case 'week': return 'Weekly'
      case 'month': return 'Monthly'
    }
  }

  const chartTooltipFormatter = (value: number) => [formatCurrency(value), 'Total Sales']

  const chartData = prepareCombinedChartData()
  const hasForecastData = !!forecastCache[timePeriod]

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