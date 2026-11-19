package com.queueforge.outbox.domain;

public enum OutboxStatus {
    PENDING,
    DISPATCHING,
    DELIVERED,
    DEAD_LETTER
}
