package com.queueforge.service.retry;

import com.queueforge.config.RetryProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Calculates exponential backoff with full/bounded jitter for retry scheduling.
 * Formula:
 * Nominal Delay(r) = min(maxDelay, initialDelay * multiplier^(r - 1))
 * Jitter = Nominal Delay * jitterFactor * random(-1.0, +1.0)
 * Final Delay = max(1, round(Nominal Delay + Jitter))
 */
@Component
public class BackoffCalculator {

    private final RetryProperties properties;

    public BackoffCalculator(RetryProperties properties) {
        this.properties = properties;
    }

    /**
     * Calculates the deterministic nominal delay in seconds without jitter.
     * @param retryCount the 1-based retry count (1 for 1st retry, 2 for 2nd retry, etc.)
     * @return nominal delay in seconds, clamped to maxDelaySeconds
     */
    public int calculateNominalDelaySeconds(int retryCount) {
        if (retryCount <= 0) {
            return properties.getInitialDelaySeconds();
        }

        double initial = properties.getInitialDelaySeconds();
        double multiplier = properties.getMultiplier();
        double max = properties.getMaxDelaySeconds();

        // initial * multiplier^(retryCount - 1)
        double exponentialDelay = initial * Math.pow(multiplier, retryCount - 1);
        double bounded = Math.min(max, exponentialDelay);

        return (int) Math.round(bounded);
    }

    /**
     * Calculates exponential backoff in seconds with random jitter.
     * @param retryCount the 1-based retry count (1 for 1st retry, 2 for 2nd retry, etc.)
     * @return jittered delay in seconds, guaranteed >= 1 and <= maxDelaySeconds * (1 + jitterFactor)
     */
    public int calculateBackoffSeconds(int retryCount) {
        double randomRatio = ThreadLocalRandom.current().nextDouble(-1.0, 1.0);
        return calculateBackoffSeconds(retryCount, randomRatio);
    }

    /**
     * Calculates backoff with an injected jitter ratio in [-1.0, 1.0].
     * Useful for deterministic testing.
     */
    public int calculateBackoffSeconds(int retryCount, double jitterRatio) {
        int nominal = calculateNominalDelaySeconds(retryCount);
        double factor = Math.max(0.0, properties.getJitterFactor());
        double clampedRatio = Math.max(-1.0, Math.min(1.0, jitterRatio));

        double jitter = nominal * factor * clampedRatio;
        long finalDelay = Math.round(nominal + jitter);

        return (int) Math.max(1, finalDelay);
    }
}
