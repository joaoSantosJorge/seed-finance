/**
 * Cross-Chain Relay Service
 *
 * Monitors events on multiple Anvil chains and relays messages between them.
 * Simulates the behavior of Circle's CCTP Attestation Service.
 *
 * Usage:
 *   npx ts-node relay.ts
 *
 * Prerequisites:
 *   1. Multi-anvil environment running (./start-multi-anvil.sh)
 *   2. Contracts deployed (./deploy-multi-chain.sh)
 */

import { ethers, Contract, Provider, Wallet, EventLog, Log } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ============ Configuration ============

interface ChainConfig {
  name: string;
  chainId: number;
  rpc: string;
  domain?: number; // CCTP domain
}

const CHAINS: Record<string, ChainConfig> = {
  base: {
    name: "Base",
    chainId: 31337,
    rpc: "http://localhost:8545",
    domain: 6,
  },
  arc: {
    name: "Arc",
    chainId: 31339,
    rpc: "http://localhost:8547",
    domain: 26,
  },
};

// Load deployment addresses
const DEPLOYMENTS_PATH = path.join(
  __dirname,
  "../../deployments/multi-chain-addresses.json"
);

// ABIs (simplified)
const CCTP_ABI = [
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)",
  "event MessageSent(bytes message)",
  "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
  "function encodeMessage(uint32 sourceDomain, uint32 destDomain, uint64 nonce, address sender, bytes32 mintRecipient, uint256 amount) external pure returns (bytes memory)",
];

const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function transfer(address, uint256) external returns (bool)",
  "function mint(address, uint256) external",
];

// ============ State ============

interface Deployments {
  base: {
    usdc: string;
    cctp: string;
    arcUSYCStrategy: string;
  };
  arc: {
    usdc: string;
    usyc: string;
    cctp: string;
    arcUSYCAgent: string;
  };
  deployer: {
    address: string;
    privateKey: string;
  };
}

let deployments: Deployments;
let providers: Record<string, Provider> = {};
let wallets: Record<string, Wallet> = {};

// ============ Relay Service ============

class CrossChainRelay {
  private running = false;
  private processedTransfers = new Set<string>();

  async start() {
    console.log("🚀 Starting Cross-Chain Relay Service...\n");

    // Load deployments
    await this.loadDeployments();

    // Initialize providers and wallets
    await this.initializeProviders();

    this.running = true;

    // Start listeners
    await Promise.all([
      this.listenCCTPEvents("base"),
      this.listenCCTPEvents("arc"),
    ]);
  }

  private async loadDeployments() {
    if (!fs.existsSync(DEPLOYMENTS_PATH)) {
      console.error("❌ Deployments file not found!");
      console.error("   Run ./deploy-multi-chain.sh first");
      process.exit(1);
    }

    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf-8"));
    console.log("✓ Loaded deployment addresses\n");
  }

  private async initializeProviders() {
    for (const [chainKey, config] of Object.entries(CHAINS)) {
      providers[chainKey] = new ethers.JsonRpcProvider(config.rpc);
      wallets[chainKey] = new Wallet(
        deployments.deployer.privateKey,
        providers[chainKey]
      );

      // Verify connection
      try {
        const network = await providers[chainKey].getNetwork();
        console.log(
          `✓ Connected to ${config.name} (Chain ID: ${network.chainId})`
        );
      } catch (error) {
        console.error(`❌ Failed to connect to ${config.name}: ${error}`);
        process.exit(1);
      }
    }
    console.log("");
  }

  // ============ CCTP Relay ============

  private async listenCCTPEvents(chainKey: string) {
    const config = CHAINS[chainKey];
    let cctpAddress: string;

    if (chainKey === "base") {
      cctpAddress = deployments.base.cctp;
    } else if (chainKey === "arc") {
      cctpAddress = deployments.arc.cctp;
    } else {
      return;
    }

    const cctp = new Contract(cctpAddress, CCTP_ABI, providers[chainKey]);

    console.log(`👀 Listening for CCTP events on ${config.name}...`);

    cctp.on(
      "DepositForBurn",
      async (
        nonce: bigint,
        burnToken: string,
        amount: bigint,
        depositor: string,
        mintRecipient: string,
        destinationDomain: number
      ) => {
        const key = `cctp-${chainKey}-${nonce}`;
        if (this.processedTransfers.has(key)) return;
        this.processedTransfers.add(key);

        console.log(`\n🔥 CCTP Burn on ${config.name}:`);
        console.log(`   Nonce: ${nonce}`);
        console.log(`   Amount: ${ethers.formatUnits(amount, 6)} USDC`);
        console.log(`   Destination Domain: ${destinationDomain}`);
        console.log(
          `   Recipient: ${ethers.getAddress(
            "0x" + mintRecipient.slice(26)
          )}`
        );

        // Determine destination chain by domain
        let destChain: string | undefined;
        if (destinationDomain === 6) {
          destChain = "base";
        } else if (destinationDomain === 26) {
          destChain = "arc";
        }

        if (!destChain) {
          console.log(`   ⚠️ Unknown destination domain`);
          return;
        }

        // Relay the CCTP message
        await this.completeCCTPTransfer(
          nonce,
          amount,
          depositor,
          mintRecipient,
          chainKey,
          destChain
        );
      }
    );
  }

  private async completeCCTPTransfer(
    nonce: bigint,
    amount: bigint,
    sender: string,
    mintRecipient: string,
    sourceChain: string,
    destChain: string
  ) {
    console.log(`   🔄 Relaying CCTP to ${CHAINS[destChain].name}...`);

    try {
      let destCctp: string;
      let destUsdc: string;

      if (destChain === "base") {
        destCctp = deployments.base.cctp;
        destUsdc = deployments.base.usdc;
      } else if (destChain === "arc") {
        destCctp = deployments.arc.cctp;
        destUsdc = deployments.arc.usdc;
      } else {
        throw new Error(`Unknown chain: ${destChain}`);
      }

      // Ensure CCTP has enough USDC to mint
      const usdc = new Contract(destUsdc, ERC20_ABI, wallets[destChain]);
      const cctpBalance = await usdc.balanceOf(destCctp);

      if (cctpBalance < amount) {
        console.log(`   📝 Funding CCTP with additional USDC...`);
        const mintTx = await usdc.mint(destCctp, amount);
        await mintTx.wait();
      }

      // Encode message
      const cctp = new Contract(destCctp, CCTP_ABI, wallets[destChain]);
      const sourceDomain = CHAINS[sourceChain].domain || 0;
      const destDomain = CHAINS[destChain].domain || 0;

      const message = await cctp.encodeMessage(
        sourceDomain,
        destDomain,
        nonce,
        sender,
        mintRecipient,
        amount
      );

      // Create mock attestation
      const attestation = ethers.toUtf8Bytes(`MOCK_ATTESTATION_${nonce}`);

      // Receive message (mints USDC to recipient)
      const tx = await cctp.receiveMessage(message, attestation);
      await tx.wait();

      const recipient = ethers.getAddress("0x" + mintRecipient.slice(26));
      console.log(`   ✅ CCTP transfer completed! USDC minted to ${recipient}`);
    } catch (error) {
      console.error(`   ❌ CCTP relay failed:`, error);
    }
  }

  async stop() {
    this.running = false;
    console.log("\n🛑 Stopping relay service...");
  }
}

// ============ Main ============

async function main() {
  const relay = new CrossChainRelay();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await relay.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await relay.stop();
    process.exit(0);
  });

  try {
    await relay.start();
  } catch (error) {
    console.error("Failed to start relay:", error);
    process.exit(1);
  }
}

main();
