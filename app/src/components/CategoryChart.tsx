import React from 'react'
import { Row, Col, Card } from 'react-bootstrap'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../utils/formatters'

interface CategoryTotal {
  category_name: string
  total_amount: number
}

interface SalesData {
  [date: string]: CategoryTotal[]
}



interface CategoryChartProps {
  salesData: SalesData
}

export const CategoryChart: React.FC<CategoryChartProps> = ({
  salesData
}) => {
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

    return chartData.sort((a, b) => b.value - a.value)
  }

  const chartTooltipFormatter = (value: number) => [formatCurrency(value), 'Total Sales']
  const chartData = calculateChartData()

  return (
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
  )
}