-- V1__create_receiver_schema.sql
-- Independent schema for simulated payment receiver

CREATE TABLE simulated_payment_charges (
    id UUID PRIMARY KEY,
    charge_reference VARCHAR(64) NOT NULL UNIQUE,
    order_id UUID NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charges_order_id ON simulated_payment_charges(order_id);
CREATE INDEX idx_charges_status ON simulated_payment_charges(status);

CREATE TABLE inbox_deduplication (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    request_fingerprint VARCHAR(64) NOT NULL,
    charge_id UUID REFERENCES simulated_payment_charges(id) ON DELETE CASCADE,
    response_payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbox_created_at ON inbox_deduplication(created_at);
