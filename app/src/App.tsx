import { useState, useEffect, useCallback } from 'react'
import { Container } from 'react-bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'

// Import components
import { DateRangeSelector } from './components/DateRangeSelector'
import { KeyMetrics } from './components/KeyMetrics'
import { SalesTrendChart } from './components/SalesTrendChart'
import { CategoryChart } from './components/CategoryChart'
import { CategoryBreakdownTable } from './components/CategoryBreakdownTable'
import { ForecastTable } from './components/ForecastTable'
import { ErrorAlert } from './components/ErrorAlert'

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

  return (
    <Container fluid className="py-4">
      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        timePeriod={timePeriod}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTimePeriodChange={setTimePeriod}
        onGenerateForecast={generateForecast}
        isGeneratingForecast={isGeneratingForecast}
        hasForecastData={!!forecastCache[timePeriod]}
        hasTimeSeriesData={timeSeriesData.length > 0}
      />

      <ErrorAlert error={error} />

      <KeyMetrics
        totalSales={totalSales}
        positiveSales={positiveSales}
        negativeSales={negativeSales}
        formatCurrency={formatCurrency}
      />

      <SalesTrendChart
        timePeriod={timePeriod}
        chartData={combinedChartData}
        hasForecastData={!!forecastCache[timePeriod]}
        formatCurrency={formatCurrency}
      />

      <CategoryChart
        chartData={chartData}
        formatCurrency={formatCurrency}
      />

      <CategoryBreakdownTable
        tableData={tableData}
        formatCurrency={formatCurrency}
      />

      <ForecastTable
        timePeriod={timePeriod}
        forecastCache={forecastCache}
        formatCurrency={formatCurrency}
      />
    </Container>
  )
}

export default App
