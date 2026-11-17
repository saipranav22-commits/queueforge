package com.queueforge.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.outbox.dto.CreateOrderRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false"
})
class OrderControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.execute("DELETE FROM inbox_deduplication");
        jdbcTemplate.execute("DELETE FROM simulated_payment_charges");
        jdbcTemplate.execute("DELETE FROM outbox_events");
        jdbcTemplate.execute("DELETE FROM orders");
    }

    @Test
    @DisplayName("POST /api/v1/orders successfully creates order and returns 201 Created")
    void testCreateOrderEndpoint() throws Exception {
        CreateOrderRequest request = new CreateOrderRequest("ORD-REST-100", "CUST-REST", 3999L, "USD");

        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.orderNumber", is("ORD-REST-100")))
                .andExpect(jsonPath("$.customerId", is("CUST-REST")))
                .andExpect(jsonPath("$.amountCents", is(3999)))
                .andExpect(jsonPath("$.currency", is("USD")))
                .andExpect(jsonPath("$.status", is("CREATED")));
    }

    @Test
    @DisplayName("GET /api/v1/orders/by-number/{orderNumber} returns order detail")
    void testGetOrderByNumberEndpoint() throws Exception {
        CreateOrderRequest request = new CreateOrderRequest("ORD-REST-200", "CUST-REST", 5500L, "USD");

        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/orders/by-number/ORD-REST-200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber", is("ORD-REST-200")))
                .andExpect(jsonPath("$.amountCents", is(5500)))
                .andExpect(jsonPath("$.status", is("CREATED")));
    }
}
