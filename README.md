# QueueForge – Reliable Job Queue with Dead-Letter Recovery

QueueForge is a high-reliability, asynchronous job processing platform engineered with Java 21, Spring Boot 3, and PostgreSQL. It delivers durable at-least-once job execution, priority-based claiming using PostgreSQL's row-level locking (`SELECT FOR UPDATE SKIP LOCKED`), heartbeat leases for crash recovery, exponential backoff retries, and an administrative Dead-Letter Queue (DLQ) with replay capabilities.

---

## Engineering Highlights

- **Durable Persistence Engine:** PostgreSQL acts as the ACID-compliant queue, eliminating the operational complexity of external brokers for moderate to high throughput workloads.
- **Contention-Free Concurrency:** Workers claim batches of prioritized jobs using `SELECT FOR UPDATE SKIP LOCKED`, preventing locking bottlenecks across concurrent worker threads.
- **Worker Crash Resilience:** Leases with heartbeats detect worker node/thread failure and automatically requeue orphaned jobs.
- **Exponential Backoff with Full Jitter:** Prevents thundering-herd retry storms against downstream dependencies.
- **Administrative Dead-Letter Replay:** Full audit execution history and API-driven dead-letter triage and replay.
- **Strict Drive Isolation:** Development environment runs with complete isolation on `D:` drive (JDK 21, Maven 3.9, Maven repository, temp directories, Docker volumes, and caches).

---

## Technology Stack

- **Runtime & Framework:** Java 21 LTS (Eclipse Temurin), Spring Boot 3.3.x
- **Persistence & Migrations:** Spring Data JPA, Hibernate, PostgreSQL 16, Flyway
- **Build & Quality:** Apache Maven 3.9.x, JUnit 5, Mockito, Testcontainers
- **Infrastructure:** Docker Compose (PostgreSQL 16 on port 5435 with volume on `D:\Projects\QueueForge\data\postgres`)

---

## Getting Started

### 1. Activate Environment (PowerShell)
All tools and caches are pinned strictly to `D:` to avoid writing to system partitions.
```powershell
# Dot-source the environment configuration into your current PowerShell session
. .\env.ps1
```

### 2. Start PostgreSQL via Docker Compose
*(Requires Phase 1B approval before launching)*
```powershell
docker compose up -d
```

### 3. Verify Backend Build
```powershell
cd backend
mvn clean compile
```

---

## Project Structure

```
QueueForge/
├── .cache/                     # Local project caches (e.g., npm)
├── backend/                    # Spring Boot 3 service
│   ├── src/main/java/          # Application source code
│   └── src/main/resources/     # Configuration and Flyway migrations
├── data/postgres/              # Persistent PostgreSQL volume on D:
├── docs/architecture/          # System architecture, schemas, and design RFCs
├── temp/                       # Redirected JVM/Surefire/Tomcat temp files
├── docker-compose.yml          # Isolated PostgreSQL service on port 5435
├── env.ps1                     # PowerShell session activation script
└── pom.xml (in backend/)       # Maven build descriptor
```

---

## Roadmap

- [x] **Phase 1A:** Safe Workspace Initialization & Environment Isolation
- [ ] **Phase 1B:** Database Containerization & Flyway Schema Ingestion
- [ ] **Phase 1C:** Job Submission REST API with Idempotency & Validation
- [ ] **Phase 2:** Concurrent Worker Engine, `SKIP LOCKED` Claiming & Lease Recovery
- [ ] **Phase 3:** Exponential Backoff, Dead-Letter Queue & Administrative Replay
- [ ] **Phase 4:** Observability, Metrics (Actuator/Prometheus) & React Admin Dashboard
