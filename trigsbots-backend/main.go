package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/sashabaranov/go-openai"
)

type TrigsbotDNA struct {
	AgentName         string `json:"agent_name"`
	SystemPrompt      string `json:"system_prompt"`
	TriggerType       string `json:"trigger_type"`
	MaxSpendPerTx     int    `json:"max_spend_per_tx"`
	DrawdownLimitPct  int    `json:"drawdown_limit_pct"`
	WithdrawalAddress string `json:"withdrawal_address"`
}

type ChatRequest struct {
	ChatHistory []openai.ChatCompletionMessage `json:"chat_history"`
}

// Upgraded AI Response with the Chain of Thought array
type AIResponse struct {
	Status           string      `json:"status"`
	MessageToUser    string      `json:"message_to_user"`
	ThoughtProcess   []string    `json:"thought_process"` // <-- Chain of Thought UI Array
	CurrentBlueprint TrigsbotDNA `json:"current_blueprint"`
}

func main() {
	app := fiber.New()
	app.Use(cors.New())

	// Configure the client to point to your local Ollama server
	config := openai.DefaultConfig("ollama")
	config.BaseURL = "http://localhost:11434/v1"
	aiClient := openai.NewClientWithConfig(config)

	// ---------------------------------------------------------
	// THE INTELLIGENT AI ROUTER
	// ---------------------------------------------------------
	app.Post("/chat-builder", func(c *fiber.Ctx) error {
		var req ChatRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
		}

		// The Ironclad Template Prompt
		systemPrompt := `You are a strict data-extraction JSON API. You MUST output a single valid JSON object containing exactly 4 top-level keys. NEVER output partial JSON.
        
        REQUIRED DATA:
        1. agent_name
        2. system_prompt (The core strategy)
        3. trigger_type ('evm_log', 'cron', or 'webhook')
        4. max_spend_per_tx (Integer)
        5. drawdown_limit_pct (Integer)
        6. withdrawal_address
        
        LOGIC:
        - Create a "thought_process" array. Write 6 strings inside it, one for each field, stating if you found it or if it is missing.
        - Fill the "current_blueprint" object. Use EXACT data from the user. DO NOT guess or invent numbers. Use "" or 0 if a field is not explicitly mentioned.
        - If all 6 fields are found, "status" is "complete" and "message_to_user" is "System Ready."
        - If any fields are missing, "status" is "gathering" and "message_to_user" asks the user for the FIRST missing field.

        YOUR OUTPUT MUST EXACTLY MATCH THIS TEMPLATE:
        {
            "status": "",
            "message_to_user": "",
            "thought_process": [],
            "current_blueprint": {
                "agent_name": "",
                "system_prompt": "",
                "trigger_type": "",
                "max_spend_per_tx": 0,
                "drawdown_limit_pct": 0,
                "withdrawal_address": ""
            }
        }`

		messages := append([]openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
		}, req.ChatHistory...)

		resp, err := aiClient.CreateChatCompletion(
			context.Background(),
			openai.ChatCompletionRequest{
				Model: "llama3.1",
				Messages: messages,
				ResponseFormat: &openai.ChatCompletionResponseFormat{
					Type: openai.ChatCompletionResponseFormatTypeJSONObject, 
				},
			},
		)

		// Catch connection/server errors
		if err != nil {
			log.Printf("❌ LOCAL AI API ERROR: %v", err)
			return c.Status(500).JSON(AIResponse{
				Status:        "gathering",
				MessageToUser: fmt.Sprintf("I hit a roadblock connecting to my local brain. Error details: %s", err.Error()),
			})
		}

		// 1. Grab raw text
		rawResponse := resp.Choices[0].Message.Content
		
		// 2. Print it to terminal for easy debugging
		log.Printf("🤖 RAW LLM RESPONSE:\n%s\n", rawResponse)

		// 3. Parse into struct
		var intelligentResponse AIResponse
		parseErr := json.Unmarshal([]byte(rawResponse), &intelligentResponse)
		
		// 4. Catch formatting/hallucination errors safely
		if parseErr != nil {
			log.Printf("❌ JSON PARSE ERROR: %v", parseErr)
			return c.Status(500).JSON(AIResponse{
				Status:        "gathering",
				MessageToUser: "My brain generated a response, but the formatting was slightly off. Check the Go terminal to see what I said!",
			})
		}

		return c.JSON(intelligentResponse)
	})

	app.Post("/deploy", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "success", "message": "Deployed!"})
	})

	log.Println("🔥 Trigsbots AI Backend running locally with Ollama (Llama 3.1) on http://localhost:3001")
	app.Listen(":3001")
}