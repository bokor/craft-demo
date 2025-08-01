package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// SalesTotal represents a record for the sales_totals_by_category_dw table
type SalesTotal struct {
	DateRecorded      string
	SaleTransactionID int
	CategoryID        int
	TotalAmount       float64
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using system environment variables")
	}

	// open database
	db, err := GetDBConnection()
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}
	defer db.Close()

	// Test the connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Clear existing data from sales_totals_by_category_dw table
	if err := clearExistingData(db); err != nil {
		log.Fatalf("Failed to clear existing data: %v", err)
	}

	// Generate and insert sales totals data
	if err := generateSalesTotals(db); err != nil {
		log.Fatalf("Failed to generate sales totals: %v", err)
	}

	log.Println("Sales totals generation completed successfully")
}

func GetDBConnection() (*sql.DB, error) {
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	psqlconn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", dbUser, dbPassword, dbHost, dbPort, dbName)

	return sql.Open("postgres", psqlconn)
}

func clearExistingData(db *sql.DB) error {
	query := "DELETE FROM sales_totals_by_category_dw"
	_, err := db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to clear existing data: %v", err)
	}
	log.Println("Cleared existing data from sales_totals_by_category_dw table")
	return nil
}

func generateSalesTotals(db *sql.DB) error {
	// Query to get sales data with category information
	query := `
		SELECT
			st.date_recorded,
			st.id as sale_transaction_id,
			p.category_id,
			sti.quantity,
			sti.total_amount,
			st.status
		FROM sale_transactions st
		JOIN sale_transaction_items sti ON st.id = sti.sale_transaction_id
		JOIN products p ON sti.product_id = p.id
		ORDER BY st.date_recorded, st.id, p.category_id
	`

	rows, err := db.Query(query)
	if err != nil {
		return fmt.Errorf("failed to query sales data: %v", err)
	}
	defer rows.Close()

	// Map to aggregate totals by date, transaction, and category
	totalsMap := make(map[string]float64)
	var records []SalesTotal

	for rows.Next() {
		var (
			dateRecorded      string
			saleTransactionID int
			categoryID        int
			quantity          int
			totalAmount       float64
			status            string
		)

		if err := rows.Scan(&dateRecorded, &saleTransactionID, &categoryID, &quantity, &totalAmount, &status); err != nil {
			return fmt.Errorf("failed to scan row: %v", err)
		}

		// Calculate the actual total for this item
		itemTotal := totalAmount

		// If it's a refund, make the amount negative
		if strings.ToLower(status) == "refund" {
			itemTotal = -itemTotal
		}

		// Create a unique key for this combination
		key := fmt.Sprintf("%s_%d_%d", dateRecorded, saleTransactionID, categoryID)

		// Aggregate totals by category for each transaction
		totalsMap[key] += itemTotal
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating rows: %v", err)
	}

	// Convert aggregated data to records
	for key, totalAmount := range totalsMap {
		parts := strings.Split(key, "_")
		if len(parts) != 3 {
			log.Printf("Warning: Invalid key format: %s", key)
			continue
		}

		dateRecorded := parts[0]
		var saleTransactionID, categoryID int
		fmt.Sscanf(parts[1], "%d", &saleTransactionID)
		fmt.Sscanf(parts[2], "%d", &categoryID)

		record := SalesTotal{
			DateRecorded:      dateRecorded,
			SaleTransactionID: saleTransactionID,
			CategoryID:        categoryID,
			TotalAmount:       totalAmount,
		}
		records = append(records, record)
	}

	// Insert records into the sales_totals_by_category_dw table
	if err := insertSalesTotals(db, records); err != nil {
		return fmt.Errorf("failed to insert sales totals: %v", err)
	}

	log.Printf("Generated %d sales total records", len(records))
	return nil
}

func insertSalesTotals(db *sql.DB, records []SalesTotal) error {
	// Prepare the insert statement
	query := `
		INSERT INTO sales_totals_by_category_dw
		(date_recorded, sale_transaction_id, category_id, total_amount)
		VALUES ($1, $2, $3, $4)
	`

	// Begin transaction for batch insert
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// Prepare the statement
	stmt, err := tx.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	// Insert records in batches
	batchSize := 100
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}

		batch := records[i:end]
		for _, record := range batch {
			_, err := stmt.Exec(
				record.DateRecorded,
				record.SaleTransactionID,
				record.CategoryID,
				record.TotalAmount,
			)
			if err != nil {
				return fmt.Errorf("failed to insert record: %v", err)
			}
		}

		log.Printf("Inserted batch %d-%d of %d records", i+1, end, len(records))
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	return nil
}
