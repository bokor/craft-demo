import React from 'react'
import { Row, Col, Card, Table } from 'react-bootstrap'

type TimePeriod = 'day' | 'week' | 'month'

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

interface ForecastTableProps {
  timePeriod: TimePeriod
  forecastCache: Record<string, ForecastResponse>
  formatCurrency: (amount: number) => string
}

export const ForecastTable: React.FC<ForecastTableProps> = ({
  timePeriod,
  forecastCache,
  formatCurrency
}) => {
  const getPeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case 'day': return 'Daily'
      case 'week': return 'Weekly'
      case 'month': return 'Monthly'
    }
  }

  return (
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
  )
}