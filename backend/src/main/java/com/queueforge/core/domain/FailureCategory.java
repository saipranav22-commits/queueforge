package com.queueforge.core.domain;

public enum FailureCategory {
    TRANSIENT_FAILURE,
    PERMANENT_FAILURE,
    LEASE_EXPIRED,
    HANDLER_NOT_FOUND
}
