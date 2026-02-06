# Encrypted Keystore Setup

## Overview

Foundry's encrypted keystore is used to store deployment private keys securely. Instead of placing private keys in plain text in `.env` files, keys are encrypted with a password and stored in Foundry's keystore directory (`~/.foundry/keystores/`). The deploy script prompts for the password at runtime.

## Changes Made

- **`contracts/.env`** — Replaced `ARC_TESTNET_PRIVATE_KEY` with `ARC_TESTNET_ACCOUNT` (keystore account name). No private keys stored in files.
- **`contracts/deploy-arc-testnet.ps1`** — Updated to use `--account` flag instead of `--private-key`. Validates the keystore account exists before running.

## How It Works

Foundry's `cast wallet` manages an encrypted keystore:

1. `cast wallet import <name> --interactive` imports a private key, encrypts it with a password, and saves it to `~/.foundry/keystores/<name>`
2. `forge script --account <name>` reads the encrypted key and prompts for the password at execution time
3. The private key is only decrypted in memory during the transaction signing

### File Layout

```
~/.foundry/keystores/
└── arc-deployer          # Encrypted JSON keystore file

contracts/
├── .env                  # ARC_TESTNET_ACCOUNT=arc-deployer (no private key)
├── .gitignore            # .env is gitignored
└── deploy-arc-testnet.ps1  # Uses --account flag
```

## Setup

### 1. Import Private Key

```powershell
cast wallet import arc-deployer --interactive
```

You will be prompted for:
- **Private key** — paste your key (input is hidden)
- **Password** — choose a password to encrypt the key

Output:
```
`arc-deployer` keystore was saved successfully. Address: 0x...
```

### 2. Verify Import

```powershell
cast wallet list
```

Should show `arc-deployer` in the list.

### 3. Configure .env

The `.env` file references the account name, not the key:

```env
ARC_TESTNET_ACCOUNT=arc-deployer
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARCSCAN_API_KEY=your-api-key
```

### 4. Deploy

```powershell
cd contracts
.\deploy-arc-testnet.ps1 -DryRun    # simulation — prompts for keystore password
.\deploy-arc-testnet.ps1             # live deploy
.\deploy-arc-testnet.ps1 -Verify    # live deploy + contract verification
```

Forge will prompt: `Enter keystore password:` each time.

## Useful Commands

```powershell
# List all keystore accounts
cast wallet list

# Check the address of a keystore account
cast wallet address --account arc-deployer

# Remove a keystore account
Remove-Item ~/.foundry/keystores/arc-deployer

# Import a different key under a new name
cast wallet import arc-deployer-2 --interactive
```

## Testing

- Run `cast wallet list` and confirm `arc-deployer` appears
- Run `.\deploy-arc-testnet.ps1 -DryRun` and confirm it prompts for password and simulates successfully

## Related Files

- `contracts/.env` — Account name and RPC config
- `contracts/deploy-arc-testnet.ps1` — Deployment script using `--account`
- `contracts/script/DeployArcTestnet.s.sol` — Foundry deployment script
- `docs/development/22_arc_testnet_deployment.md` — Deployment overview
