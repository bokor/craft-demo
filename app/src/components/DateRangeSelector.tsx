import React from 'react'
import { Row, Col, Card, Form, Button, ButtonGroup } from 'react-bootstrap'
import qbLogo from '../images/qb-logo-on-tofu-100-bkg-photo.png'

type TimePeriod = 'day' | 'week' | 'month'

interface DateRangeSelectorProps {
  startDate: string
  endDate: string
  timePeriod: TimePeriod
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onTimePeriodChange: (period: TimePeriod) => void
  onGenerateForecast: () => void
  isGeneratingForecast: boolean
  hasForecastData: boolean
  hasTimeSeriesData: boolean
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  timePeriod,
  onStartDateChange,
  onEndDateChange,
  onTimePeriodChange,
  onGenerateForecast,
  isGeneratingForecast,
  hasForecastData,
  hasTimeSeriesData
}) => {
  return (
    <Row className="mb-4">
      <Col>
        <div className="d-flex align-items-center mb-3">
          <img
            src={qbLogo}
            alt="QuickBooks Logo"
            className="qb-logo"
          />
          <h1 className="mb-0">Sales Dashboard</h1>
        </div>
        <Card>
          <Card.Body>
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
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
                        onClick={() => onTimePeriodChange(period)}
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
                    onClick={onGenerateForecast}
                    disabled={isGeneratingForecast || !hasTimeSeriesData || hasForecastData}
                    variant="success"
                    className="w-100"
                    size="sm"
                  >
                    {isGeneratingForecast ? 'Generating...' : hasForecastData ? 'Forecast Generated' : 'Generate Forecast'}
                  </Button>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  )
}