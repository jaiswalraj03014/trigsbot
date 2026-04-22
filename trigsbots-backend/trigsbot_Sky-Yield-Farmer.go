package main

import (
	"fmt"
	"log/slog"

	"github.com/ethereum/go-ethereum/common"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/blockchain/evm"
	"github.com/smartcontractkit/cre-sdk-go/cre"
)

// --- 🧬 INJECTED TRIGSBOT DNA 🧬 ---
const (
	BotName      = "Sky-Yield-Farmer"
	SystemPrompt = `You are a conservative risk manager. Only buy WETH when it drops 5%.`
	Trigger      = "evm_log"
)
// -----------------------------------

type Config struct{}

func InitWorkflow(config *Config, logger *slog.Logger, secretsProvider cre.SecretsProvider) (cre.Workflow[*Config], error) {
	logger.Info(fmt.Sprintf("Booting up %s...", BotName))
	logger.Info(fmt.Sprintf("Core Directive: %s", SystemPrompt))

	// 16015286601757825753 is Sepolia
	logTrigger := evm.LogTrigger(16015286601757825753, &evm.FilterLogTriggerRequest{
		Addresses: [][]byte{common.HexToAddress("0xYourSmartWalletAddress").Bytes()},
	})

	return cre.Workflow[*Config]{
		cre.Handler(logTrigger, onTrigger),
	}, nil
}

func onTrigger(config *Config, runtime cre.Runtime, log *evm.Log) (*cre.NilConfig, error) {
	// The AI execution logic will go here
	return nil, nil
}