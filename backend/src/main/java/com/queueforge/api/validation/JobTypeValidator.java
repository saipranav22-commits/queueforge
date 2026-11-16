package com.queueforge.api.validation;

import com.queueforge.core.domain.SupportedJobType;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class JobTypeValidator implements ConstraintValidator<ValidJobType, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return false;
        }
        boolean valid = SupportedJobType.isValid(value);
        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                    String.format("Unsupported job type: '%s'. Supported types: %s",
                            value, SupportedJobType.getSupportedNames())
            ).addConstraintViolation();
        }
        return valid;
    }
}
