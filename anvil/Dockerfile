FROM ghcr.io/foundry-rs/foundry:latest AS builder
WORKDIR /app
COPY contracts/ ./
RUN forge build

FROM ghcr.io/foundry-rs/foundry:latest
WORKDIR /app
COPY --from=builder /app .
COPY anvil/start.sh ./start.sh
RUN chmod +x ./start.sh
ENTRYPOINT ["sh", "./start.sh"]
