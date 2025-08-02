import React from 'react'
import { Row, Col, Card } from 'react-bootstrap'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartDataPoint {
  name: string
  value: number
}

interface CategoryChartProps {
  chartData: ChartDataPoint[]
  formatCurrency: (amount: number) => string
}

export const CategoryChart: React.FC<CategoryChartProps> = ({
  chartData,
  formatCurrency
}) => {
  const chartTooltipFormatter = (value: number) => [formatCurrency(value), 'Total Sales']

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