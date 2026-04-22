package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"

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
	ChatHistory      []openai.ChatCompletionMessage `json:"chat_history"`
	CurrentBlueprint TrigsbotDNA                    `json:"current_blueprint"`
}

type AIResponse struct {
	Status           string      `json:"status"`
	MessageToUser    string      `json:"message_to_user"`
	Reasoning        string      `json:"reasoning"`
	ThoughtProcess   []string    `json:"thought_process"` // The terminal logs
	CurrentBlueprint TrigsbotDNA `json:"current_blueprint"`
}

func main() {
	app := fiber.New()
	app.Use(cors.New())

	config := openai.DefaultConfig("ollama")
	config.BaseURL = "http://localhost:11434/v1"
	aiClient := openai.NewClientWithConfig(config)

	app.Post("/chat-builder", func(c *fiber.Ctx) error {
		var req ChatRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
		}

		systemPrompt := `You are a data extractor. Look at the user's latest message and extract any requested fields.
        First, write out your "reasoning" explaining what you found in the text.
        Then, populate the fields. If a field is not found in their latest text, leave it blank ("" or 0).
        
        OUTPUT ONLY VALID JSON:
        {
            "reasoning": "Explain your thought process here...",
            "agent_name": "",
            "system_prompt": "",
            "trigger_type": "",
            "max_spend_per_tx": 0,
            "drawdown_limit_pct": 0,
            "withdrawal_address": ""
        }`

		messages := append([]openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
		}, req.ChatHistory...)

		// 1. OPEN THE SSE STREAM HEADERS
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")

		// 2. START THE LIVE STREAM
		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			stream, err := aiClient.CreateChatCompletionStream(
				context.Background(),
				openai.ChatCompletionRequest{
					Model: "qwen3:4b",
					Messages: messages,
					ResponseFormat: &openai.ChatCompletionResponseFormat{
						Type: openai.ChatCompletionResponseFormatTypeJSONObject,
					},
				},
			)

			if err != nil {
				log.Printf("❌ AI Stream Error: %v", err)
				fmt.Fprintf(w, "event: error\ndata: AI offline\n\n")
				w.Flush()
				return
			}
			defer stream.Close()

			var rawTextBuilder strings.Builder

			// 3. PIPE TOKENS TO THE FRONTEND AS THEY GENERATE
			for {
				response, err := stream.Recv()
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					log.Printf("❌ Stream Read Error: %v", err)
					break
				}

				token := response.Choices[0].Delta.Content
				rawTextBuilder.WriteString(token)

				// Send raw token chunk to frontend
				// We replace newlines so SSE doesn't break
				safeToken := strings.ReplaceAll(token, "\n", "\\n")
				fmt.Fprintf(w, "event: token\ndata: %s\n\n", safeToken)
				w.Flush()
			}

			rawText := rawTextBuilder.String()
			log.Printf("🤖 STREAM FINISHED. RAW LLM RESPONSE:\n%s\n", rawText)

			// 4. THE AI IS DONE. RUN OUR DETERMINISTIC LOGIC.
			type TempExtraction struct {
				Reasoning string `json:"reasoning"`
				TrigsbotDNA
			}
			var extractedData TempExtraction
			json.Unmarshal([]byte(rawText), &extractedData)

			blueprint := req.CurrentBlueprint
			if extractedData.AgentName != "" { blueprint.AgentName = extractedData.AgentName }
			if extractedData.SystemPrompt != "" { blueprint.SystemPrompt = extractedData.SystemPrompt }
			if extractedData.TriggerType != "" { blueprint.TriggerType = extractedData.TriggerType }
			if extractedData.MaxSpendPerTx > 0 { blueprint.MaxSpendPerTx = extractedData.MaxSpendPerTx }
			if extractedData.DrawdownLimitPct > 0 { blueprint.DrawdownLimitPct = extractedData.DrawdownLimitPct }
			if extractedData.WithdrawalAddress != "" { blueprint.WithdrawalAddress = extractedData.WithdrawalAddress }

			var thoughts []string
			var missingFields []string

			// Build terminal logs dynamically
			if strings.TrimSpace(blueprint.AgentName) != "" { thoughts = append(thoughts, fmt.Sprintf("agent_name: Found (%s)", blueprint.AgentName)) } else { thoughts = append(thoughts, "agent_name: missing"); missingFields = append(missingFields, "agent_name") }
			if strings.TrimSpace(blueprint.SystemPrompt) != "" { thoughts = append(thoughts, "system_prompt: Found") } else { thoughts = append(thoughts, "system_prompt: missing"); missingFields = append(missingFields, "system_prompt") }
			if strings.TrimSpace(blueprint.TriggerType) != "" { thoughts = append(thoughts, fmt.Sprintf("trigger_type: Found (%s)", blueprint.TriggerType)) } else { thoughts = append(thoughts, "trigger_type: missing"); missingFields = append(missingFields, "trigger_type") }
			if blueprint.MaxSpendPerTx > 0 { thoughts = append(thoughts, fmt.Sprintf("max_spend_per_tx: Found (%d)", blueprint.MaxSpendPerTx)) } else { thoughts = append(thoughts, "max_spend_per_tx: missing"); missingFields = append(missingFields, "max_spend_per_tx") }
			if blueprint.DrawdownLimitPct > 0 { thoughts = append(thoughts, fmt.Sprintf("drawdown_limit_pct: Found (%d%%)", blueprint.DrawdownLimitPct)) } else { thoughts = append(thoughts, "drawdown_limit_pct: missing"); missingFields = append(missingFields, "drawdown_limit_pct") }
			if strings.TrimSpace(blueprint.WithdrawalAddress) != "" { thoughts = append(thoughts, "withdrawal_address: Found") } else { thoughts = append(thoughts, "withdrawal_address: missing"); missingFields = append(missingFields, "withdrawal_address") }

			finalResponse := AIResponse{
				CurrentBlueprint: blueprint,
				Reasoning:        extractedData.Reasoning,
				ThoughtProcess:   thoughts, // Attach the logs we just built
			}

			if len(missingFields) > 0 {
				finalResponse.Status = "gathering"
				switch missingFields[0] {
				case "agent_name": finalResponse.MessageToUser = "Let's start building. What should we name this agent?"
				case "system_prompt": finalResponse.MessageToUser = "What is the core directive or trading strategy for this agent?"
				case "trigger_type": finalResponse.MessageToUser = "How should this execute? (e.g., cron schedule, webhook, evm_log)"
				case "max_spend_per_tx": finalResponse.MessageToUser = "To enforce safety limits, what is the max USDC spend per transaction?"
				case "drawdown_limit_pct": finalResponse.MessageToUser = "What percentage of drawdown should trigger the killswitch? (e.g., 5, 10)"
				case "withdrawal_address": finalResponse.MessageToUser = "Finally, provide the cold wallet address for yields and withdrawals."
				}
			} else {
				finalResponse.Status = "complete"
				finalResponse.MessageToUser = "All parameters verified. System Ready."
			}

			// 5. FIRE THE FINAL EVENT WITH THE VERIFIED DATA
			finalBytes, _ := json.Marshal(finalResponse)
			fmt.Fprintf(w, "event: complete\ndata: %s\n\n", string(finalBytes))
			w.Flush()
		})
		return nil
	})

	app.Listen(":3001")
	log.Println("🔥 Trigsbots AI Backend running locally with Ollama (Qwen 4B) on http://localhost:3001")
}