package com.queueforge.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.dto.LoginRequest;
import com.queueforge.api.security.AdminAuthInterceptor;
import com.queueforge.api.security.AuthSessionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
@AutoConfigureMockMvc
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuthSessionService sessionService;

    private static final String VALID_KEY = "qf_admin_dev_secret_2026";

    @Test
    @DisplayName("POST /api/v1/auth/login with valid admin key sets HttpOnly cookie and returns CSRF token")
    void login_validKey_establishesSession() throws Exception {
        LoginRequest req = new LoginRequest(VALID_KEY);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists(AuthController.SESSION_COOKIE_NAME))
                .andExpect(cookie().httpOnly(AuthController.SESSION_COOKIE_NAME, true))
                .andExpect(jsonPath("$.authenticated", is(true)))
                .andExpect(jsonPath("$.username", is("admin")))
                .andExpect(jsonPath("$.csrfToken", notNullValue()))
                .andExpect(jsonPath("$.expiresAt", notNullValue()));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login with invalid key returns 401")
    void login_invalidKey_returnsUnauthorized() throws Exception {
        LoginRequest req = new LoginRequest("wrong_secret_key");

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.1"); // isolated IP for this test
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("Invalid administrative authentication key")));
    }

    @Test
    @DisplayName("GET /api/v1/auth/session returns unauthenticated when no cookie provided")
    void session_noCookie_returnsUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated", is(false)));
    }

    @Test
    @DisplayName("Cookie-authenticated session allows access to Admin DLQ endpoints with CSRF token")
    void adminAccess_withValidSessionAndCsrf_succeeds() throws Exception {
        // 1. Login
        LoginRequest loginReq = new LoginRequest(VALID_KEY);
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie sessionCookie = loginResult.getResponse().getCookie(AuthController.SESSION_COOKIE_NAME);
        String responseBody = loginResult.getResponse().getContentAsString();
        String csrfToken = objectMapper.readTree(responseBody).get("csrfToken").asText();

        // 2. Read DLQ list using cookie (GET request, no CSRF needed for read)
        mockMvc.perform(get("/api/v1/admin/dlq")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page", is(0)));

        // 3. Mutating request without CSRF token fails with 403 Forbidden
        mockMvc.perform(post("/api/v1/admin/dlq/" + UUID.randomUUID() + "/replay")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Invalid or missing CSRF token")));

        // 4. Mutating request with valid CSRF token passes auth check (fails at service layer for non-existent job with 404)
        mockMvc.perform(post("/api/v1/admin/dlq/" + UUID.randomUUID() + "/replay")
                        .cookie(sessionCookie)
                        .header(AdminAuthInterceptor.CSRF_HEADER, csrfToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /api/v1/auth/logout clears session and expires cookie")
    void logout_clearsSession() throws Exception {
        LoginRequest loginReq = new LoginRequest(VALID_KEY);
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie sessionCookie = loginResult.getResponse().getCookie(AuthController.SESSION_COOKIE_NAME);

        // Logout
        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge(AuthController.SESSION_COOKIE_NAME, 0));

        // Subsequent session check is unauthenticated
        mockMvc.perform(get("/api/v1/auth/session")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated", is(false)));
    }
}
