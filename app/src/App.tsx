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



interface ForecastResponse {
  forecast: ForecastData[]
  timePeriod: string
  message: string
  rawResponse?: string
}

type TimePeriod = 'day' | 'week' | 'month'



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

  // Calculate totals for metrics and table data
  const calculateTotals = () => {
    const categoryTotals: { [key: string]: number } = {}
    const allCategories = Object.values(salesData).flat()

    // Aggregate by category
    allCategories.forEach(category => {
      categoryTotals[category.category_name] = (categoryTotals[category.category_name] || 0) + category.total_amount
    })

    return categoryTotals
  }

  const categoryTotals = calculateTotals()
  const totalSales = Object.values(salesData).flat().reduce((sum, category) => sum + category.total_amount, 0)
  const positiveSales = Object.values(salesData).flat().reduce((sum, category) => sum + Math.max(0, category.total_amount), 0)
  const negativeSales = Math.abs(Object.values(salesData).flat().reduce((sum, category) => sum + Math.min(0, category.total_amount), 0))

  // Generate forecast using ChatGPT service
  const generateForecast = useCallback(async () => {
    // Check if we have sales data
    if (Object.keys(salesData).length === 0) {
      setError('No data available for forecasting')
      return
    }

    setIsGeneratingForecast(true)
    setError(null)

    try {
      // Prepare time series data for forecasting
      const prepareTimeSeriesData = () => {
        const groupedData: { [key: string]: number } = {}

        Object.entries(salesData).forEach(([dateStr, categories]) => {
          const date = new Date(dateStr)
          let periodKey = ''

          switch (timePeriod) {
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

      const timeSeriesData = prepareTimeSeriesData()

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
  }, [salesData, timePeriod])

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
        hasTimeSeriesData={Object.keys(salesData).length > 0}
      />

      <ErrorAlert error={error} />

      <KeyMetrics
        totalSales={totalSales}
        positiveSales={positiveSales}
        negativeSales={negativeSales}
      />

      <SalesTrendChart
        timePeriod={timePeriod}
        salesData={salesData}
        forecastCache={forecastCache}
      />

      <CategoryChart
        salesData={salesData}
      />

      <CategoryBreakdownTable
        tableData={tableData}
      />

      <ForecastTable
        timePeriod={timePeriod}
        forecastCache={forecastCache}
      />
    </Container>
  )
}

export default App
