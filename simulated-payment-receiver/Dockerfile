# Stage 1: Build application JAR
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source code and package application skipping unit/integration tests
COPY src ./src
RUN mvn clean package -DskipTests -B -U

# Stage 2: Minimal hardened runtime
FROM eclipse-temurin:21-jre-alpine

# Security: Add non-root system user and group
RUN addgroup -S receiver && adduser -S receiver -G receiver

WORKDIR /app

RUN mkdir -p /app/logs && chown -R receiver:receiver /app

COPY --from=builder --chown=receiver:receiver /build/target/simulated-payment-receiver-*.jar /app/app.jar

USER receiver:receiver

ENV SERVER_PORT=8098 \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8098

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=25s \
    CMD wget -qO- http://127.0.0.1:${SERVER_PORT:-8098}/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
