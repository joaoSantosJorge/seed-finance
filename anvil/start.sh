#!/bin/sh
set -e

echo "============================================="
echo "  Seed Finance — Anvil Node + Deploy + Seed"
echo "============================================="

# Railway injects $PORT; default to 8545 for local testing
PORT="${PORT:-8545}"

echo "Starting Anvil on port $PORT..."
anvil \
  --host 0.0.0.0 \
  --port "$PORT" \
  --no-cors \
  --block-time 2 \
  --accounts 12 \
  --balance 10000 &

ANVIL_PID=$!

# Wait for Anvil to be ready
echo "Waiting for Anvil to be ready..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if cast chain-id --rpc-url "http://127.0.0.1:$PORT" 2>/dev/null; then
    echo "Anvil is ready!"
    break
  fi
  RETRIES=$((RETRIES - 1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "ERROR: Anvil failed to start"
  exit 1
fi

# Deploy contracts
echo ""
echo "Deploying contracts with DeployLocal.s.sol..."
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url "http://127.0.0.1:$PORT" \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Seed demo data
echo ""
echo "Seeding demo data with SeedDemo.s.sol..."
forge script script/SeedDemo.s.sol:SeedDemo \
  --rpc-url "http://127.0.0.1:$PORT" \
  --broadcast

echo ""
echo "============================================="
echo "  Anvil running on port $PORT"
echo "  Contracts deployed and demo data seeded!"
echo "============================================="

# Keep container alive by waiting on Anvil process
wait $ANVIL_PID
