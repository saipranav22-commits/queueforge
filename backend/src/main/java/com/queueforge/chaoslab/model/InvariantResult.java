package com.queueforge.chaoslab.model;

import java.util.Collections;
import java.util.List;

public record InvariantResult(
        String invariantId,
        String name,
        boolean passed,
        String message,
        List<String> evidence
) {
    public static InvariantResult pass(String invariantId, String name, String message, List<String> evidence) {
        return new InvariantResult(invariantId, name, true, message, evidence != null ? evidence : Collections.emptyList());
    }

    public static InvariantResult fail(String invariantId, String name, String message, List<String> evidence) {
        return new InvariantResult(invariantId, name, false, message, evidence != null ? evidence : Collections.emptyList());
    }
}
