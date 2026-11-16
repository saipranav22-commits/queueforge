package com.queueforge.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = JobTypeValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidJobType {
    String message() default "Unsupported job type. Must be one of the registered job types";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
