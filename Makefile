# Makefile for Craft Demo

.PHONY: all generate-sales-totals app-install app-dev app-build generate-docs seed-db dev server migrate-db

# Generate sales totals data for the data warehouse table
generate-sales-totals:
	go run batch/generate_sales_totals.go

# Frontend app commands
app-install:
	cd app && npm install

app-dev:
	cd app && npm run dev

app-build:
	cd app && npm run build

# Combined development (run both backend and frontend)
dev:
	@echo "Starting backend server..."
	@go run cmd/server/main.go &
	@echo "Starting frontend development server..."
	@cd app && npm run dev

server:
	go run cmd/server/main.go

generate-docs:
	swag init -g cmd/server/main.go

migrate-db:
	goose up

seed-db:
	go run db/seeds/seed.go

# Run all setup and development targets
all:
	@echo "=== Setting up Craft Demo ==="
	@echo "1. Generating API documentation..."
	@$(MAKE) generate-docs
	@echo "2. Installing frontend dependencies..."
	@$(MAKE) app-install
	@echo "3. Seeding database..."
	@$(MAKE) seed-db
	@echo "4. Generating sales totals..."
	@$(MAKE) generate-sales-totals
	@echo "5. Starting development servers..."
	@$(MAKE) dev
