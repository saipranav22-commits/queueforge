package com.queueforge.core.domain;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum SupportedJobType {
    GENERATE_REPORT,
    SEND_EMAIL,
    DATA_EXPORT,
    INDEX_DOCUMENT,
    WEBHOOK_DISPATCH,
    CLEANUP_TEMP_DATA;

    private static final Set<String> TYPE_NAMES = Arrays.stream(values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

    public static boolean isValid(String typeName) {
        if (typeName == null) {
            return false;
        }
        return TYPE_NAMES.contains(typeName.trim().toUpperCase());
    }

    public static Set<String> getSupportedNames() {
        return TYPE_NAMES;
    }
}
