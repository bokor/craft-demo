# Craft Demo - Sales Analytics & Forecasting Platform

A comprehensive sales analytics and forecasting platform built with Go (backend) and React (frontend). This application provides real-time sales reporting, category analysis, and AI-powered sales forecasting using ChatGPT integration.

## 🚀 Features

- **Sales Analytics Dashboard**: Real-time sales data visualization with interactive charts
- **Category Breakdown**: Detailed sales analysis by product categories
- **AI-Powered Forecasting**: Sales forecasting using ChatGPT API with fallback to statistical models
- **Data Warehouse**: PostgreSQL-based data warehouse with sample data
- **RESTful API**: Swagger-documented API endpoints
- **Modern Frontend**: React-based dashboard with Bootstrap styling


## 🏗️ Architecture

```
craft-demo/
├── app/                    # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   └── App.tsx         # Main application
├── services/               # Go backend services
│   ├── sales_forecast.go   # AI forecasting service
│   └── sales_report.go     # Sales reporting service
├── db/                     # Database management
│   ├── migrations/         # Database migrations
│   └── seeds/              # Sample data seeding
├── batch/                  # Batch processing scripts
├── docs/                   # API documentation
└── server.go               # Main server entry point
```

## 🛠️ Technology Stack

### Backend
- **Go 1.24.5**: High-performance server-side language
- **Echo Framework**: Fast HTTP web framework
- **PostgreSQL**: Primary database
- **Swagger**: API documentation
- **ChatGPT API**: AI-powered forecasting

### Frontend
- **React 19**: Modern UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **Bootstrap 5**: Responsive UI components
- **Recharts**: Data visualization library

## 📋 Prerequisites

- Go 1.24.5 or higher
- Node.js 18+ and npm
- PostgreSQL 12+
- Git

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd craft-demo
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=craft_demo

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=8080
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb craft_demo

# Seed the database with sample data
make seed-db
```

### 4. Install Dependencies

```bash
# Install Go dependencies
go mod download

# Install frontend dependencies
make app-install
```

### 5. Generate Sample Data

```bash
# Generate sales totals for the data warehouse
make generate-sales-totals
```

### 6. Start the Application

```bash
# Start both backend and frontend in development mode
make dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/api/v1/swagger/

## 📚 API Documentation

### Sales Report by Category

**Endpoint**: `GET /api/v1/sales/report/category`

Returns aggregated sales data by category for a specified date range.

**Query Parameters**:
- `start_date` (optional): Start date in YYYY-MM-DD format (defaults to 6 months ago)
- `end_date` (optional): End date in YYYY-MM-DD format (defaults to today)

**Example Request**:
```bash
curl "http://localhost:8080/api/v1/sales/report/category?start_date=2024-01-01&end_date=2024-01-31"
```

**Response**:
```json
{
  "2024-01-01": [
    {
      "category_name": "Electronics",
      "total_amount": 1500.00
    },
    {
      "category_name": "Clothing",
      "total_amount": 800.00
    }
  ]
}
```

### Sales Forecasting

**Endpoint**: `POST /api/v1/sales/forecast`

Generates sales forecasts using AI or statistical models.

**Request Body**:
```json
{
  "timeSeriesData": [
    {
      "period": "2024-01-01",
      "total": 1000.00
    },
    {
      "period": "2024-01-02",
      "total": 1200.00
    }
  ],
  "timePeriod": "month"
}
```

**Response**:
```json
{
  "forecast": [
    {
      "period": "2024-02-01",
      "total": 1500.00
    }
  ],
  "timePeriod": "month",
  "message": "Forecast generated successfully"
}
```



## 🛠️ Development

### Available Make Commands

```bash
# Generate API documentation
make generate-docs

# Install frontend dependencies
make app-install

# Start frontend development server
make app-dev

# Build frontend for production
make app-build

# Start backend server only
make server

# Seed database
make seed-db

# Generate sales totals
make generate-sales-totals

# Full setup (docs, install, seed, generate, dev)
make all
```

### Project Structure

#### Backend Services

- **`services/sales_forecast.go`**: AI-powered sales forecasting with ChatGPT integration
- **`services/sales_report_by_category.go`**: Sales reporting and analytics
- **`server.go`**: Main server with Echo framework and middleware

#### Frontend Components

- **`DateRangeSelector`**: Date range picker for reports
- **`CategoryChart`**: Visual category breakdown
- **`SalesTrendChart`**: Sales trend visualization
- **`ForecastTable`**: Forecast data display
- **`KeyMetrics`**: Key performance indicators
- **`CategoryBreakdownTable`**: Detailed category data table

#### Database

- **`db/seeds/`**: Sample data for testing and development
- **`db/migrations/`**: Database schema migrations
- **`batch/generate_sales_totals.go`**: Data warehouse population script

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USER` | Database username | postgres |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | craft_demo |
| `OPENAI_API_KEY` | OpenAI API key for forecasting | - |
| `PORT` | Server port | 8080 |

### API Authentication

The `/admin` endpoints are protected with basic authentication:
- Username: `joe`
- Password: `secret`

## 📊 Data Model

### Core Entities

- **Categories**: Product categories (Electronics, Clothing, etc.)
- **Products**: Individual products with category associations
- **Customers**: Customer information
- **Companies**: Company data
- **Sale Transactions**: Sales records with timestamps
- **Sale Transaction Items**: Individual items in sales

### Data Warehouse

The application includes a data warehouse table `sales_totals_by_category_dw` that aggregates sales data by category and date for efficient reporting.

## 🚀 Deployment

### Production Build

```bash
# Build frontend
make app-build

# Run backend
make server
```

### Docker (Optional)

```bash
# Build and run with Docker
docker build -t craft-demo .
docker run -p 8080:8080 craft-demo
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Go coding standards
- Update API documentation
- Ensure code quality and documentation

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the API documentation at `/api/v1/swagger/`
- Review the test files for usage examples
- Open an issue on GitHub

## 🔄 Changelog

### Version 1.0.0
- Initial release with sales analytics dashboard
- AI-powered forecasting with ChatGPT integration
- Swagger API documentation
- React frontend with data visualization

---

**Built with ❤️ using Go and React**
