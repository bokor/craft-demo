package services

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/bokor/craft-demo/internal/database"
	"github.com/labstack/echo/v4"
)

// CategoryTotal represents the total amount for a category
type CategoryTotal struct {
	CategoryName string  `json:"category_name"`
	TotalAmount  float64 `json:"total_amount"`
}

// SalesReportResponse represents the response structure
type SalesReportResponse struct {
	Categories []CategoryTotal `json:"categories"`
}

// GetSalesReportByCategory handles the API request for sales report by category
// @Summary Get sales report by category
// @Description Returns aggregated sales data by date and category with calculated total amounts
// @Tags sales
// @Accept json
// @Produce json
// @Param start_date query string false "Start date in YYYY-MM-DD format (defaults to 30 days ago)"
// @Param end_date query string false "End date in YYYY-MM-DD format (defaults to today)"
// @Success 200 {object} map[string][]CategoryTotal "Sales report data with dates as keys and category arrays as values"
// @Failure 400 {object} map[string]string "Bad request - invalid date format"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /sales/report/category [get]
func GetSalesReportByCategory(c echo.Context) error {
	// Get query parameters
	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")

	// Validate date parameters - use a wider default range to ensure we have data
	if startDate == "" {
		startDate = time.Now().AddDate(0, -6, 0).Format("2006-01-02") // Default to last 6 months
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02") // Default to today
	}

	// Validate date format
	if _, err := time.Parse("2006-01-02", startDate); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid start_date format. Use YYYY-MM-DD",
		})
	}
	if _, err := time.Parse("2006-01-02", endDate); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid end_date format. Use YYYY-MM-DD",
		})
	}

	// Get database connection
	db, err := database.GetDBConnection()
	if err != nil {
		log.Printf("Database connection failed: %v, falling back to sample data", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Database connection failed",
		})
	}
	defer db.Close()

	// Query sales data
	salesData, err := querySalesData(db, startDate, endDate)
	if err != nil {
		log.Printf("Failed to query sales data: %v, falling back to sample data", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to query sales data",
		})
	}

	// If no data found, return sample data for testing
	if len(salesData) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "No sales data found",
		})
	}

	// Return the response - each date key directly contains the categories array
	return c.JSON(http.StatusOK, salesData)
}

// querySalesData queries the database and returns aggregated sales data
func querySalesData(db *sql.DB, startDate, endDate string) (map[string][]CategoryTotal, error) {
	query := `
		SELECT
			DATE(st.date_recorded) as date_recorded,
			c.name as category_name,
			SUM(st.total_amount) as total_amount
		FROM sales_totals_by_category_dw st
		JOIN categories c ON st.category_id = c.id
		WHERE st.date_recorded >= $1 AND st.date_recorded <= $2
		GROUP BY DATE(st.date_recorded), c.name
		ORDER BY DATE(st.date_recorded), c.name
	`

	rows, err := db.Query(query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query sales data: %v", err)
	}
	defer rows.Close()

	// Map to store results: date -> []CategoryTotal
	result := make(map[string][]CategoryTotal)

	for rows.Next() {
		var (
			dateRecorded string
			categoryName string
			totalAmount  float64
		)

		if err := rows.Scan(&dateRecorded, &categoryName, &totalAmount); err != nil {
			return nil, fmt.Errorf("failed to scan row: %v", err)
		}

		// Parse and format the date to remove timestamp
		parsedDate, err := time.Parse("2006-01-02T15:04:05Z", dateRecorded)
		if err != nil {
			// Try alternative format if the first one fails
			parsedDate, err = time.Parse("2006-01-02", dateRecorded)
			if err != nil {
				return nil, fmt.Errorf("failed to parse date %s: %v", dateRecorded, err)
			}
		}

		// Format as YYYY-MM-DD
		formattedDate := parsedDate.Format("2006-01-02")

		// Initialize the date slice if it doesn't exist
		if result[formattedDate] == nil {
			result[formattedDate] = []CategoryTotal{}
		}

		// Add the category total to the slice
		result[formattedDate] = append(result[formattedDate], CategoryTotal{
			CategoryName: categoryName,
			TotalAmount:  totalAmount,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %v", err)
	}

	return result, nil
}
