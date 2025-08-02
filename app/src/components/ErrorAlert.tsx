import React from 'react'
import { Row, Col, Alert } from 'react-bootstrap'

interface ErrorAlertProps {
  error: string | null
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ error }) => {
  if (!error) return null

  return (
    <Row className="mb-4">
      <Col>
        <Alert variant="danger">{error}</Alert>
      </Col>
    </Row>
  )
}