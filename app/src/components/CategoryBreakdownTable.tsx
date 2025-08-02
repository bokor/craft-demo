import React from 'react'
import { Row, Col, Card, Table } from 'react-bootstrap'

interface TableRow {
  category: string
  total: string
  isRefund: boolean
  percentage: string
}

interface CategoryBreakdownTableProps {
  tableData: TableRow[]
  formatCurrency: (amount: number) => string
}

export const CategoryBreakdownTable: React.FC<CategoryBreakdownTableProps> = ({
  tableData,
  formatCurrency
}) => {
  return (
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
  )
}