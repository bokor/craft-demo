import React from 'react'
import { Row, Col, Card } from 'react-bootstrap'

interface KeyMetricsProps {
  totalSales: number
  positiveSales: number
  negativeSales: number
  formatCurrency: (amount: number) => string
}

export const KeyMetrics: React.FC<KeyMetricsProps> = ({
  totalSales,
  positiveSales,
  negativeSales,
  formatCurrency
}) => {
  return (
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
  )
}