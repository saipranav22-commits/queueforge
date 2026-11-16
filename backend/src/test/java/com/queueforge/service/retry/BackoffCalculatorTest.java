package com.queueforge.service.retry;

import com.queueforge.config.RetryProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BackoffCalculatorTest {

    private RetryProperties properties;
    private BackoffCalculator calculator;

    @BeforeEach
    void setUp() {
        properties = new RetryProperties();
        properties.setInitialDelaySeconds(5);
        properties.setMultiplier(3.0);
        properties.setMaxDelaySeconds(3600);
        properties.setJitterFactor(0.20); // +/- 20%
        calculator = new BackoffCalculator(properties);
    }

    @Test
    @DisplayName("Retry 1 calculates nominal initial delay of 5 seconds")
    void testInitialDelay() {
        int delay = calculator.calculateNominalDelaySeconds(1);
        assertThat(delay).isEqualTo(5);
    }

    @Test
    @DisplayName("Retry 2 scales exponentially: 5 * 3^1 = 15 seconds")
    void testSecondRetryDelay() {
        int delay = calculator.calculateNominalDelaySeconds(2);
        assertThat(delay).isEqualTo(15);
    }

    @Test
    @DisplayName("Retry 3 scales exponentially: 5 * 3^2 = 45 seconds")
    void testThirdRetryDelay() {
        int delay = calculator.calculateNominalDelaySeconds(3);
        assertThat(delay).isEqualTo(45);
    }

    @Test
    @DisplayName("Retry 4 scales exponentially: 5 * 3^3 = 135 seconds")
    void testFourthRetryDelay() {
        int delay = calculator.calculateNominalDelaySeconds(4);
        assertThat(delay).isEqualTo(135);
    }

    @Test
    @DisplayName("Delay is capped at maxDelaySeconds")
    void testMaxDelayBound() {
        properties.setMaxDelaySeconds(60);
        calculator = new BackoffCalculator(properties);

        int delay = calculator.calculateNominalDelaySeconds(10);
        assertThat(delay).isEqualTo(60);
    }

    @Test
    @DisplayName("Jitter stays within the +/- 20% bound")
    void testJitterBounds() {
        int nominal = calculator.calculateNominalDelaySeconds(3); // 45s
        int minJittered = calculator.calculateBackoffSeconds(3, -1.0); // 45 * 0.8 = 36s
        int maxJittered = calculator.calculateBackoffSeconds(3, 1.0);  // 45 * 1.2 = 54s

        assertThat(minJittered).isEqualTo(36);
        assertThat(maxJittered).isEqualTo(54);

        for (int i = 0; i < 50; i++) {
            int randomDelay = calculator.calculateBackoffSeconds(3);
            assertThat(randomDelay).isBetween(minJittered, maxJittered);
        }
    }
}
