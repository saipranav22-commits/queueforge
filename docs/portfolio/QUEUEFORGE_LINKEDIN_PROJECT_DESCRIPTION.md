# QueueForge V2 — LinkedIn & Portfolio Announcement Post

**Post Title:** Building an ACID-Durable Distributed Task Engine with Java 21, Spring Boot 3, and PostgreSQL 16  
**Live Interactive Demo:** https://queueforge.pages.dev  
**GitHub Repository:** https://github.com/saipranav22-commits/queueforge  

---

### LinkedIn Post Copy

When building asynchronous background processing, engineers often immediately reach for Kafka or RabbitMQ.

While message brokers are powerful, they introduce the notorious **Dual-Write Hazard**: what happens when your relational database commits a transaction, but the network request to publish to the broker fails mid-flight? Your task is permanently lost.

To solve this, I designed and built **QueueForge V2** — turning PostgreSQL 16 into an ACID-compliant, contention-free distributed task queue and outbox processor.

Here are the key distributed systems challenges solved:

1. **Contention-Free Worker Claiming:**  
Using PostgreSQL 16's `SELECT FOR UPDATE SKIP LOCKED` inside atomic CTEs, concurrent Spring Boot worker JVMs claim batches simultaneously with zero row-lock waiting.

2. **Solving the Noisy-Neighbor Problem (DRR FairShare):**  
In multi-tenant systems, one flood tenant can starve all other tenants under naive FIFO queuing. I implemented a Deficit Round Robin (DRR) scheduler that cut quiet-tenant median wait times by **89.8% (11.8s down to 1.2s)** under a synthetic 1,000-job flood test, achieving perfect Jain's fairness (1.000) at an observed 21% throughput tradeoff (89.65 -> 70.62 jobs/s).

3. **Split-Brain Lease Fencing:**  
Tasks are leased for 30 seconds with monotonic version tokens (`claim_version`). If a worker encounters a long GC pause, a background reaper safely reclaims the job. When the zombie worker finally resumes, its write is fenced out cleanly.

4. **Transactional Outbox & Exactly-Once Semantics:**  
Domain entities and outbox events commit together atomically in a single ACID transaction. Downstream receivers enforce idempotency using SHA-256 payload deduplication keys.

5. **Operations Control Plane (Titanium × Ember):**  
Built with React 19, TypeScript, and Tailwind CSS, featuring an interactive **Scenario Explorer** that lets anyone test architectural failure modes directly in their browser without running a local backend cluster.

The entire platform is open-source, containerized in a decoupled 7-service micro-cluster, and validated by **302 automated tests** (187 backend, 13 receiver, 82 frontend, 20 Playwright) and 8 Docker smoke stages across 7 passing GitHub Actions jobs.

Check out the live interactive demo on Cloudflare Pages:  
👉 https://queueforge.pages.dev

Explore the architecture and source code on GitHub:  
👉 https://github.com/saipranav22-commits/queueforge

#Java #SpringBoot #PostgreSQL #DistributedSystems #React #TypeScript #Docker #SoftwareEngineering #Cloudflare
