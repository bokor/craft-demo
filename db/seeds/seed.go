package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq" // PostgreSQL driver
)

const (
	seedDir = "db/seeds/data"
)

type Seed struct {
	Table   string   `json:"table"`
	Columns []string `json:"columns"`
	Values  [][]any  `json:"values"`
}

func main() {

	// load .env file from given path
	// we keep it empty it will load .env from current directory
	err := godotenv.Load(".env")

	if err != nil {
		log.Fatalf("Error loading .env file")
	}

	// open database
	db, err := GetDBConnection()
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}

	// seed database
	seed(db)

	// close database
	defer db.Close()
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

func CheckError(err error) {
	if err != nil {
		panic(err)
	}
}

func seed(db *sql.DB) {
	files, err := os.ReadDir(seedDir)
	if err != nil {
		log.Println("Error reading seed directory:", err)
		return
	}

	for _, file := range files {
		f := strings.Split(file.Name(), ".")

		if file.IsDir() || f[len(f)-1] != "json" {
			continue
		}
		content, err := os.ReadFile(filepath.Join(seedDir, file.Name()))
		if err != nil {
			log.Printf("Error reading file %s: %v\n", file.Name(), err)
			continue
		}
		var data Seed
		if err := json.Unmarshal(content, &data); err != nil {
			log.Printf("Error unmarshalling JSON from file %s: %v\n", file.Name(), err)
			continue
		}

		execQuery(data, db, file.Name())
	}
}

func execQuery(data Seed, db *sql.DB, filename string) {
	db.Exec("TRUNCATE TABLE " + data.Table + " RESTART IDENTITY CASCADE")
	// Prepare the SQL statement
	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		data.Table,
		strings.Join(data.Columns, ","),
		prepareInsertQuery(data.Columns),
	)

	for _, value := range data.Values {
		_, err := db.Exec(query, value...)
		if err != nil {
			log.Printf("Error executing query for file %s: %v\n", filename, err)
		}
	}
}

func prepareInsertQuery(columns []string) string {
	var query string

	for i := range columns {
		if i != len(columns)-1 {
			query += fmt.Sprintf("$%s,", strconv.Itoa(i+1))
			continue
		}
		query += fmt.Sprintf("$%s", strconv.Itoa(i+1))
	}
	return query
}
