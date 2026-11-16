package com.queueforge.api.controller;

import com.queueforge.api.dto.AuthSessionResponse;
import com.queueforge.api.dto.LoginRequest;
import com.queueforge.api.dto.MessageResponse;
import com.queueforge.api.security.AuthSessionService;
import com.queueforge.api.security.SessionInfo;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    public static final String SESSION_COOKIE_NAME = "QF_SESSION";

    private final AuthSessionService sessionService;

    public AuthController(AuthSessionService sessionService) {
        this.sessionService = sessionService;
    }

    /**
     * Authenticates an administrator and issues an HttpOnly session cookie.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
                                   HttpServletRequest httpRequest,
                                   HttpServletResponse httpResponse) {
        String clientIp = getClientIp(httpRequest);
        Optional<SessionInfo> sessionOpt = sessionService.login(request.adminKey(), clientIp);

        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResponse("Invalid administrative authentication key"));
        }

        SessionInfo session = sessionOpt.get();

        // Configure HttpOnly session cookie
        ResponseCookie sessionCookie = ResponseCookie.from(SESSION_COOKIE_NAME, session.getSessionId())
                .httpOnly(true)
                .secure(httpRequest.isSecure())
                .path("/api/v1")
                .sameSite("Lax")
                .maxAge(SessionInfo.SESSION_TTL)
                .build();

        httpResponse.addHeader(HttpHeaders.SET_COOKIE, sessionCookie.toString());

        return ResponseEntity.ok(AuthSessionResponse.authenticated(
                "admin",
                session.getCsrfToken(),
                session.getExpiresAt()
        ));
    }

    /**
     * Checks current session validity and returns authentication status.
     */
    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> checkSession(HttpServletRequest request) {
        Optional<String> sessionIdOpt = extractSessionCookie(request);

        if (sessionIdOpt.isPresent()) {
            Optional<SessionInfo> sessionOpt = sessionService.getSession(sessionIdOpt.get());
            if (sessionOpt.isPresent()) {
                SessionInfo session = sessionOpt.get();
                return ResponseEntity.ok(AuthSessionResponse.authenticated(
                        "admin",
                        session.getCsrfToken(),
                        session.getExpiresAt()
                ));
            }
        }

        return ResponseEntity.ok(AuthSessionResponse.unauthenticated());
    }

    /**
     * Invalidates the active admin session and clears the session cookie.
     */
    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        extractSessionCookie(request).ifPresent(sessionService::invalidateSession);

        ResponseCookie expiredCookie = ResponseCookie.from(SESSION_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(request.isSecure())
                .path("/api/v1")
                .sameSite("Lax")
                .maxAge(0)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
        return ResponseEntity.ok(new MessageResponse("Successfully logged out"));
    }

    private Optional<String> extractSessionCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> SESSION_COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
