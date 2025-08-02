import { useState, useEffect, useCallback } from 'react'
import { Container, Row, Col, Card, Form, Button, Alert, Table, ButtonGroup } from 'react-bootstrap'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'

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

type TimePeriod = 'day' | 'week' | 'month'

// Currency formatter for consistent dollar formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function App() {
  const [salesData, setSalesData] = useState<SalesData>({})
  const [forecastCache, setForecastCache] = useState<Record<string, ForecastResponse>>({})
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')

  // Set default date range (use a range that has data)
  useEffect(() => {
    const today = new Date()
    const startDate = new Date('2024-01-01') // Use a date range that has data

    setEndDate(today.toISOString().split('T')[0])
    setStartDate(startDate.toISOString().split('T')[0])
  }, [])

  const fetchSalesData = useCallback(async () => {
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      console.log('Fetching data from:', `/api/v1/sales/report/category?${params}`)
      const response = await fetch(`/api/v1/sales/report/category?${params}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Received data:', data)
      setSalesData(data)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    }
  }, [startDate, endDate])



  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesData()
    }
  }, [startDate, endDate, fetchSalesData])

  // Clear forecast cache when date range changes (since data changes)
  useEffect(() => {
    setForecastCache({})
  }, [startDate, endDate])

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

  // Calculate totals and prepare chart data
  const calculateChartData = () => {
    const categoryTotals: { [key: string]: number } = {}
    const allCategories = Object.values(salesData).flat()

    // Aggregate by category
    allCategories.forEach(category => {
      categoryTotals[category.category_name] = (categoryTotals[category.category_name] || 0) + category.total_amount
    })

    // Convert to chart format
    const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.abs(value) // Use absolute value for chart
    }))

    return {
      chartData: chartData.sort((a, b) => b.value - a.value),
      categoryTotals
    }
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

  const { chartData, categoryTotals } = calculateChartData()
  const timeSeriesData = prepareTimeSeriesData()
  const combinedChartData = prepareCombinedChartData()

  // Generate forecast using ChatGPT service
  const generateForecast = useCallback(async () => {
    if (timeSeriesData.length === 0) {
      setError('No data available for forecasting')
      return
    }

    setIsGeneratingForecast(true)
    setError(null)

    try {
      // Prepare data for forecasting
      const forecastRequest = {
        timeSeriesData: timeSeriesData,
        timePeriod: timePeriod
      }

      console.log('Sending forecast request:', forecastRequest)

      const response = await fetch('/api/v1/sales/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forecastRequest)
      })

      if (!response.ok) {
        throw new Error(`Forecast request failed: ${response.status}`)
      }

      const forecastResult: ForecastResponse = await response.json()
      console.log('Forecast result:', forecastResult)

      // Cache the forecast result for this time period
      setForecastCache(prev => ({
        ...prev,
        [timePeriod]: forecastResult
      }))
    } catch (err) {
      console.error('Error generating forecast:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate forecast')
    } finally {
      setIsGeneratingForecast(false)
    }
  }, [timeSeriesData, timePeriod])

  // Debug logging
  console.log('Time series data:', timeSeriesData)
  console.log('Time period:', timePeriod)
  console.log('Sample data point:', timeSeriesData[0])
  console.log('Data structure valid:', timeSeriesData.length > 0 && timeSeriesData[0]?.period && typeof timeSeriesData[0]?.total === 'number')
  console.log('Forecast cache:', forecastCache)
  console.log('Current forecast data:', forecastCache[timePeriod])
  console.log('Combined chart data:', combinedChartData)
  console.log('Raw ChatGPT response:', forecastCache[timePeriod]?.rawResponse)

  const totalSales = Object.values(salesData).flat().reduce((sum, category) => sum + category.total_amount, 0)
  const positiveSales = Object.values(salesData).flat().reduce((sum, category) => sum + Math.max(0, category.total_amount), 0)
  const negativeSales = Math.abs(Object.values(salesData).flat().reduce((sum, category) => sum + Math.min(0, category.total_amount), 0))

  // Prepare table data
  const tableData = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total: total.toFixed(2),
      isRefund: total < 0,
      percentage: ((Math.abs(total) / Math.abs(totalSales)) * 100).toFixed(1)
    }))
    .sort((a, b) => Math.abs(parseFloat(b.total)) - Math.abs(parseFloat(a.total)))

  // Custom tooltip formatter for charts
  const chartTooltipFormatter = (value: number) => [formatCurrency(value), 'Total Sales']

  const getPeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case 'day': return 'Daily'
      case 'week': return 'Weekly'
      case 'month': return 'Monthly'
    }
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="mb-3">Sales Dashboard</h1>
          <Card>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>End Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Time Period</Form.Label>
                    <ButtonGroup className="w-100">
                      {(['day', 'week', 'month'] as TimePeriod[]).map((period) => (
                        <Button
                          key={period}
                          variant={timePeriod === period ? 'primary' : 'outline-primary'}
                          onClick={() => setTimePeriod(period)}
                          size="sm"
                        >
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>&nbsp;</Form.Label>
                    <Button
                      onClick={generateForecast}
                      disabled={isGeneratingForecast || timeSeriesData.length === 0 || !!forecastCache[timePeriod]}
                      variant="success"
                      className="w-100"
                      size="sm"
                    >
                      {isGeneratingForecast ? 'Generating...' : forecastCache[timePeriod] ? 'Forecast Generated' : 'Generate Forecast'}
                    </Button>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="danger">{error}</Alert>
          </Col>
        </Row>
      )}

      {/* Key Metrics */}
      <Row className="mb-4">
        <Col md={4}>
          <Card>
            <Card.Body>
              <h5>Total Sales</h5>
              <h3>{formatCurrency(totalSales)}</h3>
              <small className="text-muted">Net sales including refunds</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <h5>Gross Sales</h5>
              <h3>{formatCurrency(positiveSales)}</h3>
              <small className="text-muted">Total positive transactions</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <h5>Total Refunds</h5>
              <h3>{formatCurrency(negativeSales)}</h3>
              <small className="text-muted">Total refunded amount</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Time Series Chart */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Body>
              <h5>{getPeriodLabel(timePeriod)} Sales Trend</h5>
              {forecastCache[timePeriod] && (
                <div className="mb-2">
                  <small className="text-muted">
                    Forecast data available for {getPeriodLabel(forecastCache[timePeriod].timePeriod as TimePeriod)} period.
                  </small>
                </div>
              )}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={combinedChartData} margin={{ left: 80, right: 30, top: 5, bottom: 5 }}>
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
                  {forecastCache[timePeriod] && forecastCache[timePeriod].forecast && forecastCache[timePeriod].forecast.length > 0 && (
                    <Line type="monotone" dataKey="forecast" stroke="#ff7300" strokeDasharray="5 5" name="Forecast" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

                    {/* Category Chart */}
              <Row className="mb-4">
                <Col>
                  <Card>
                    <Card.Body>
                      <h5>Sales by Category</h5>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ left: 80, right: 30, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                            width={80}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip formatter={chartTooltipFormatter} />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" name="By Category" />
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-muted">Distribution of sales across categories</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Category Breakdown Table */}
              <Row>
                <Col>
                  <Card>
                    <Card.Body>
                      <h5>Category Breakdown</h5>
                      <Table striped bordered hover responsive>
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Total Amount</th>
                            <th>Percentage</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, index) => (
                            <tr key={index}>
                              <td>{row.category}</td>
                              <td className={row.isRefund ? 'text-danger' : 'text-success'}>
                                {formatCurrency(parseFloat(row.total))}
                              </td>
                              <td>{row.percentage}%</td>
                              <td>
                                <span className={`badge ${row.isRefund ? 'bg-danger' : 'bg-success'}`}>
                                  {row.isRefund ? 'Refund' : 'Sale'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Forecast Values Table */}
              <Row className="mt-4">
                <Col>
                  <Card>
                    <Card.Body>
                      <h5>{getPeriodLabel(timePeriod)} Forecast Values</h5>
                      <Table striped bordered hover responsive>
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>Forecasted Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastCache[timePeriod] ? (
                            forecastCache[timePeriod].forecast.map((forecastPoint, index) => (
                              <tr key={`${timePeriod}-${index}`}>
                                <td>{forecastPoint.period}</td>
                                <td className="text-success">
                                  {formatCurrency(forecastPoint.total)}
                                </td>
                                <td>
                                  <span className="badge bg-success">Forecasted</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="text-center text-muted">
                                No forecast data available for {getPeriodLabel(timePeriod)}. Generate a forecast to see data here.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

      {/* Debug Section - Raw ChatGPT Response */}
      {forecastCache[timePeriod]?.rawResponse && (
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Body>
                <h5>Raw ChatGPT Response</h5>
                <pre className="debug-response">
                  {forecastCache[timePeriod].rawResponse}
                </pre>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  )
}

export default App
