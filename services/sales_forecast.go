package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
)

// ForecastRequest represents the request structure for forecasting
type ForecastRequest struct {
	TimeSeriesData []TimeSeriesPoint `json:"timeSeriesData"`
	// TimePeriod is now optional - if not specified, all periods will be generated
	TimePeriod        string `json:"timePeriod,omitempty"`
	PeriodsToForecast int    `json:"periodsToForecast,omitempty"`
}

// TimeSeriesPoint represents a single data point in the time series
type TimeSeriesPoint struct {
	Period string  `json:"period"`
	Total  float64 `json:"total"`
}

// ForecastResponse represents the response from the forecast service
type ForecastResponse struct {
	Forecast    []TimeSeriesPoint `json:"forecast"`
	TimePeriod  string            `json:"timePeriod"`
	Message     string            `json:"message"`
	RawResponse string            `json:"rawResponse,omitempty"`
}

// ChatGPTRequest represents the request to ChatGPT API
type ChatGPTRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

// Message represents a message in the ChatGPT conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatGPTResponse represents the response from ChatGPT API
type ChatGPTResponse struct {
	Choices []Choice `json:"choices"`
}

// Choice represents a choice in the ChatGPT response
type Choice struct {
	Message Message `json:"message"`
}

// GenerateSalesForecast handles the API request for sales forecasting
// @Summary Generate sales forecast using ChatGPT
// @Description Sends time series data to ChatGPT for forecasting and returns predicted values for daily, weekly, and monthly periods
// @Tags sales
// @Accept json
// @Produce json
// @Param request body ForecastRequest true "Forecast request with time series data"
// @Success 200 {object} ForecastResponse "Forecast data with predicted values for all time periods"
// @Failure 400 {object} map[string]string "Bad request - invalid data"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /sales/forecast [post]
func GenerateSalesForecast(c echo.Context) error {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using system environment variables")
	}

	// Parse request body
	var request ForecastRequest
	if err := c.Bind(&request); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request format",
		})
	}

	// Validate request
	if len(request.TimeSeriesData) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "No time series data provided",
		})
	}

	// Determine the time period to forecast (default to month if not specified)
	timePeriod := request.TimePeriod
	if timePeriod == "" {
		timePeriod = "month"
	}

	// Generate forecast for the specific time period
	response := ForecastResponse{
		TimePeriod: timePeriod,
		Message:    "Forecast generated successfully",
	}

	// Generate forecast using ChatGPT
	forecast, rawResponse, err := generateForecastForPeriod(request, timePeriod)
	if err != nil {
		log.Printf("Failed to generate forecast: %v", err)
		// Fallback to simple forecast
		response.Forecast = generateSimpleForecast(createRequestForPeriod(request, timePeriod))
	} else {
		response.Forecast = forecast
		response.RawResponse = rawResponse
	}

	return c.JSON(http.StatusOK, response)
}

// createRequestForPeriod creates a request for a specific time period
func createRequestForPeriod(request ForecastRequest, timePeriod string) ForecastRequest {
	newRequest := request
	newRequest.TimePeriod = timePeriod
	newRequest.PeriodsToForecast = getForecastPeriods(timePeriod)
	return newRequest
}

// generateForecastForPeriod sends data to ChatGPT for forecasting a specific time period
func generateForecastForPeriod(request ForecastRequest, timePeriod string) ([]TimeSeriesPoint, string, error) {
	// Get ChatGPT API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Printf("No OpenAI API key found, using simple forecast")
		// If no API key, generate a simple forecast based on trend
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (no API key)", nil
	}

	// Check if we have a valid API key
	if apiKey == "" || len(apiKey) < 10 {
		log.Printf("No valid OpenAI API key found, using simple forecast")
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (invalid API key)", nil
	}

	// Validate API key format (should start with sk-)
	if len(apiKey) < 3 || apiKey[:3] != "sk-" {
		log.Printf("Invalid OpenAI API key format, using simple forecast")
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (invalid API key format)", nil
	}

	log.Printf("Using ChatGPT for %s forecasting with API key: %s...", timePeriod, apiKey[:7])

	// Test the API first
	if err := testOpenAIAPI(apiKey); err != nil {
		log.Printf("OpenAI API test failed: %v", err)
		log.Printf("Falling back to simple forecast")
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (API test failed)", nil
	}

	// Prepare the prompt for ChatGPT
	prompt := buildForecastPromptForPeriod(request, timePeriod)

	// Create ChatGPT request
	chatGPTRequest := ChatGPTRequest{
		Model: "gpt-3.5-turbo", // Use 3.5-turbo for better compatibility
		Messages: []Message{
			{
				Role:    "system",
				Content: "You are a data analyst specializing in time series forecasting. Provide forecasts in JSON format with an array of objects containing 'period' and 'total' fields.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
	}

	// Send request to ChatGPT
	response, err := sendChatGPTRequest(apiKey, chatGPTRequest)
	if err != nil {
		log.Printf("ChatGPT request failed: %v", err)
		// Fallback to simple forecast
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (ChatGPT request failed)", nil
	}

	// Parse ChatGPT response
	forecast, rawResponse, err := parseSinglePeriodChatGPTResponse(response)
	if err != nil {
		log.Printf("Failed to parse ChatGPT response: %v", err)
		// Fallback to simple forecast
		return generateSimpleForecast(createRequestForPeriod(request, timePeriod)), "Simple forecast generated (parsing failed)", nil
	}

	return forecast, rawResponse, nil
}

// buildForecastPromptForPeriod creates the prompt for single-period ChatGPT forecasting
func buildForecastPromptForPeriod(request ForecastRequest, timePeriod string) string {
	// Filter to only include the past 12 months of data
	filteredData := filterToLast12Months(request.TimeSeriesData)

	// Convert time series data to XML format
	xmlData := "<historical_data>\n"
	for _, point := range filteredData {
		xmlData += fmt.Sprintf("  <data_point>\n    <period>%s</period>\n    <total>%.2f</total>\n  </data_point>\n", point.Period, point.Total)
	}
	xmlData += "</historical_data>"

	// Filter data based on the requested time period
	var periodData []TimeSeriesPoint
	switch timePeriod {
	case "day":
		periodData = filterToDailyData(filteredData)
	case "week":
		periodData = filterToWeeklyData(filteredData)
	case "month":
		periodData = filteredData // Already monthly data
	default:
		periodData = filteredData
	}

	// Convert time series data to XML format
	xmlData = "<historical_data>\n"
	for _, point := range periodData {
		xmlData += fmt.Sprintf("  <data_point>\n    <period>%s</period>\n    <total>%.2f</total>\n  </data_point>\n", point.Period, point.Total)
	}
	xmlData += "</historical_data>"

	// Get forecast periods based on time period
	forecastPeriods := getForecastPeriods(timePeriod)
	var periodLabel string
	switch timePeriod {
	case "day":
		periodLabel = "daily"
	case "week":
		periodLabel = "weekly"
	case "month":
		periodLabel = "monthly"
	default:
		periodLabel = "period"
	}

	prompt := fmt.Sprintf(`
You are a data analyst specializing in time series forecasting. You are given historical %s sales data for a single category.
Using this historical data, provide a %s sales forecast for the next %d periods, highlighting potential seasonal fluctuations.

Things to consider:
 - Sales data is for a single category of multiple products.
 - The response should follow the JSON format below.
 - Consider trends, seasonality, and patterns in the data.
 - Remove any data points that are anomalies or outliers.

<historical_data>
%s
</historical_data>

Please provide the forecast in JSON response format like this:
[
  {"period": "2024-01-01", "total": 1500.00},
  {"period": "2024-01-02", "total": 1600.00}
]

Consider trends, seasonality, and patterns in the data.`,
		periodLabel, periodLabel, forecastPeriods, xmlData)

	log.Printf("Generated %s forecast prompt: %s", timePeriod, prompt)

	return prompt
}

// filterToDailyData filters data to daily format (placeholder - assumes data is already daily)
func filterToDailyData(data []TimeSeriesPoint) []TimeSeriesPoint {
	// For now, assume data is already in the correct format
	// In a real implementation, you might need to aggregate or disaggregate data
	return data
}

// filterToWeeklyData filters data to weekly format (placeholder - assumes data is already weekly)
func filterToWeeklyData(data []TimeSeriesPoint) []TimeSeriesPoint {
	// For now, assume data is already in the correct format
	// In a real implementation, you might need to aggregate or disaggregate data
	return data
}

// sendChatGPTRequest sends a request to the ChatGPT API
func sendChatGPTRequest(apiKey string, request ChatGPTRequest) (*ChatGPTResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	// Log the request for debugging (only first 200 chars to avoid logging sensitive data)
	requestPreview := string(jsonData)
	if len(requestPreview) > 200 {
		requestPreview = requestPreview[:200] + "..."
	}
	log.Printf("Sending request to ChatGPT: %s", requestPreview)

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("User-Agent", "CraftDemo/1.0")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Log response status for debugging
	log.Printf("ChatGPT API response status: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		// Read and log the actual error response
		bodyBytes, err := json.Marshal(resp.Body)
		if err != nil {
			log.Printf("Failed to read error response body: %v", err)
		} else {
			log.Printf("ChatGPT API error response: %s", string(bodyBytes))
		}

		// Check for specific error types
		switch resp.StatusCode {
		case 401:
			return nil, fmt.Errorf("OpenAI API authentication failed - check your API key")
		case 404:
			return nil, fmt.Errorf("OpenAI API endpoint not found - check API version")
		case 429:
			return nil, fmt.Errorf("OpenAI API rate limit exceeded")
		case 500:
			return nil, fmt.Errorf("OpenAI API server error")
		default:
			return nil, fmt.Errorf("OpenAI API returned status: %d", resp.StatusCode)
		}
	}

	var response ChatGPTResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	log.Printf("ChatGPT API response: %v", &response)

	return &response, nil
}

// parseSinglePeriodChatGPTResponse parses the single-period response from ChatGPT
func parseSinglePeriodChatGPTResponse(response *ChatGPTResponse) ([]TimeSeriesPoint, string, error) {
	if len(response.Choices) == 0 {
		return nil, "", fmt.Errorf("no choices in ChatGPT response")
	}

	content := response.Choices[0].Message.Content
	log.Printf("ChatGPT single-period response content: %s", content)

	// Try to extract JSON from the response
	// Look for JSON array in the content
	start := 0
	end := len(content)

	// Find the start of JSON array
	for i := 0; i < len(content)-1; i++ {
		if content[i] == '[' {
			start = i
			break
		}
	}

	// Find the end of JSON array
	for i := len(content) - 1; i > start; i-- {
		if content[i] == ']' {
			end = i + 1
			break
		}
	}

	if start >= end {
		return nil, content, fmt.Errorf("could not find JSON array in response")
	}

	jsonStr := content[start:end]
	log.Printf("Extracted single-period JSON: %s", jsonStr)

	var forecast []TimeSeriesPoint
	if err := json.Unmarshal([]byte(jsonStr), &forecast); err != nil {
		return nil, content, fmt.Errorf("failed to parse single-period JSON: %v", err)
	}

	return forecast, content, nil
}

// generateSimpleForecast creates a simple forecast based on trend when ChatGPT is not available
func generateSimpleForecast(request ForecastRequest) []TimeSeriesPoint {
	// Filter to only include the past 12 months of data for consistency
	filteredData := filterToLast12Months(request.TimeSeriesData)

	if len(filteredData) < 2 {
		return []TimeSeriesPoint{}
	}

	// Calculate trend and volatility
	values := make([]float64, len(filteredData))
	for i, point := range filteredData {
		values[i] = point.Total
	}

	// Calculate moving average for trend
	windowSize := 3
	if len(values) < windowSize {
		windowSize = len(values)
	}

	recentValues := values[len(values)-windowSize:]
	avgRecent := 0.0
	for _, v := range recentValues {
		avgRecent += v
	}
	avgRecent /= float64(len(recentValues))

	// Calculate trend based on recent vs older data
	olderValues := values[:len(values)-windowSize]
	if len(olderValues) > 0 {
		avgOlder := 0.0
		for _, v := range olderValues {
			avgOlder += v
		}
		avgOlder /= float64(len(olderValues))

		// Trend is the difference between recent and older averages
		trend := (avgRecent - avgOlder) / float64(windowSize)

		// Add some seasonality and randomness
		seasonality := 0.1 // 10% seasonal variation
		volatility := 0.05 // 5% random variation

		// Generate forecast
		forecast := make([]TimeSeriesPoint, request.PeriodsToForecast)
		lastPeriod := filteredData[len(filteredData)-1].Period

		for i := 0; i < request.PeriodsToForecast; i++ {
			// Generate next period based on time period
			nextPeriod := generateNextPeriod(lastPeriod, request.TimePeriod, i+1)

			// Calculate forecast value with trend, seasonality, and volatility
			baseValue := avgRecent + trend*float64(i+1)

			// Add seasonal variation (simple sine wave)
			seasonalFactor := 1.0 + seasonality*math.Sin(float64(i)*math.Pi/6)

			// Add small random variation
			randomFactor := 1.0 + (rand.Float64()-0.5)*volatility*2

			forecastValue := baseValue * seasonalFactor * randomFactor
			if forecastValue < 0 {
				forecastValue = 0 // Don't allow negative sales
			}

			forecast[i] = TimeSeriesPoint{
				Period: nextPeriod,
				Total:  forecastValue,
			}
		}

		return forecast
	}

	// Fallback to simple linear trend
	trend := (avgRecent - values[0]) / float64(len(values)-1)
	forecast := make([]TimeSeriesPoint, request.PeriodsToForecast)
	lastPeriod := filteredData[len(filteredData)-1].Period

	for i := 0; i < request.PeriodsToForecast; i++ {
		nextPeriod := generateNextPeriod(lastPeriod, request.TimePeriod, i+1)
		forecastValue := avgRecent + trend*float64(i+1)
		if forecastValue < 0 {
			forecastValue = 0
		}

		forecast[i] = TimeSeriesPoint{
			Period: nextPeriod,
			Total:  forecastValue,
		}
	}

	return forecast
}

// getForecastPeriods returns the number of periods to forecast based on time period
func getForecastPeriods(timePeriod string) int {
	switch timePeriod {
	case "day":
		return 14 // 14 days of forecasts
	case "week":
		return 4 // 4 weeks of forecasts
	case "month":
		return 6 // 6 months of forecasts
	default:
		return 12 // Default fallback
	}
}

// filterToLast12Months filters time series data to only include the past 12 months
func filterToLast12Months(data []TimeSeriesPoint) []TimeSeriesPoint {
	if len(data) == 0 {
		return data
	}

	// Find the latest date in the data
	var latestDate time.Time
	for _, point := range data {
		// Try to parse the period as different date formats
		var date time.Time
		var err error

		// Try YYYY-MM-DD format first
		date, err = time.Parse("2006-01-02", point.Period)
		if err != nil {
			// Try YYYY-MM format
			date, err = time.Parse("2006-01", point.Period)
			if err != nil {
				// Skip this point if we can't parse it
				continue
			}
		}

		if date.After(latestDate) {
			latestDate = date
		}
	}

	// Calculate the cutoff date (12 months ago from the latest date)
	cutoffDate := latestDate.AddDate(0, -12, 0)

	// Filter data to only include points from the last 12 months
	var filteredData []TimeSeriesPoint
	for _, point := range data {
		var date time.Time
		var err error

		// Try YYYY-MM-DD format first
		date, err = time.Parse("2006-01-02", point.Period)
		if err != nil {
			// Try YYYY-MM format
			date, err = time.Parse("2006-01", point.Period)
			if err != nil {
				// Skip this point if we can't parse it
				continue
			}
		}

		// Include only data from the last 12 months
		if date.After(cutoffDate) || date.Equal(cutoffDate) {
			filteredData = append(filteredData, point)
		}
	}

	log.Printf("Filtered data from %d points to %d points (last 12 months)", len(data), len(filteredData))
	return filteredData
}

// generateNextPeriod generates the next period string based on the time period type
func generateNextPeriod(lastPeriod, timePeriod string, offset int) string {
	// Parse the last period to get the base date
	var baseDate time.Time
	var err error

	switch timePeriod {
	case "day":
		// Parse YYYY-MM-DD format
		baseDate, err = time.Parse("2006-01-02", lastPeriod)
		if err != nil {
			// Fallback to current date if parsing fails
			baseDate = time.Now()
		}
		// Add offset days
		nextDate := baseDate.AddDate(0, 0, offset)
		return nextDate.Format("2006-01-02")

	case "week":
		// Parse YYYY-MM-DD format (week start date)
		baseDate, err = time.Parse("2006-01-02", lastPeriod)
		if err != nil {
			baseDate = time.Now()
		}
		// Add offset weeks
		nextDate := baseDate.AddDate(0, 0, offset*7)
		return nextDate.Format("2006-01-02")

	case "month":
		// Parse YYYY-MM format
		baseDate, err = time.Parse("2006-01", lastPeriod)
		if err != nil {
			// Try parsing as YYYY-MM-DD and extract year/month
			baseDate, err = time.Parse("2006-01-02", lastPeriod)
			if err != nil {
				baseDate = time.Now()
			}
		}
		// Add offset months
		nextDate := baseDate.AddDate(0, offset, 0)
		return nextDate.Format("2006-01")

	default:
		return fmt.Sprintf("forecast-%d", offset)
	}
}

// testOpenAIAPI tests if the OpenAI API key and endpoint are working
func testOpenAIAPI(apiKey string) error {
	// Simple test request
	testRequest := ChatGPTRequest{
		Model: "gpt-3.5-turbo", // Use cheaper model for testing
		Messages: []Message{
			{
				Role:    "user",
				Content: "Hello, this is a test message. Please respond with 'OK'.",
			},
		},
	}

	jsonData, err := json.Marshal(testRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal test request: %v", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create test request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("User-Agent", "CraftDemo/1.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("test request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("test request failed with status: %d", resp.StatusCode)
	}

	log.Printf("OpenAI API test successful")
	return nil
}
