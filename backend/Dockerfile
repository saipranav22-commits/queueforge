# Stage 1: Build application JAR
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source code and package application skipping unit/integration tests (which require live DB)
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Minimal hardened runtime
FROM eclipse-temurin:21-jre-alpine

# Security: Add non-root system user and group
RUN addgroup -S queueforge && adduser -S queueforge -G queueforge

WORKDIR /app

# Create logs directory with proper non-root permissions
RUN mkdir -p /app/logs && chown -R queueforge:queueforge /app

# Copy executable jar from builder stage
COPY --from=builder --chown=queueforge:queueforge /build/target/queueforge-backend-*.jar /app/app.jar

USER queueforge:queueforge

ENV SERVER_PORT=8085 \
    LOG_FILE=/app/logs/queueforge.log \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8085

# Built-in Alpine wget performs health probe against actuator liveness state
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=25s \
    CMD wget -qO- http://127.0.0.1:${SERVER_PORT:-8085}/actuator/health/liveness || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
