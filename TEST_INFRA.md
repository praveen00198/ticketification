# E2E Test Infra: Ticketification Optimizations

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation internals.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Full Database Excel Export Query | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Host Permission Scoping & IDOR Prevention | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Fast Deterministic Storage URL Construction | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Client Error State Hygiene | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Defensive API Response Unwrapping | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Per-Row Import Error Isolation | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Job Ingestion & Render Status Decoupling | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Removal of Manual Generate Button & Modal | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 9 | Real-Time Ticket Generation Progress UI | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 10 | Resilient Resume/Retry Generation Action | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 11 | Cooperative Event Loop Yielding | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 12 | Sharp PNG Compression Tuning | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 13 | Elimination of Redundant Inline Base64 Font | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 14 | Throttled Garbage Collection & DB Writes | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 15 | Synchronous Generation Fallback to Queue | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Jest (`npm test`)
- Pass/Fail semantics: All tests pass with exit code 0, zero memory leaks, zero IDOR leaks.

## Coverage Thresholds
- Tier 1: Feature Coverage (>=5 per feature)
- Tier 2: Boundary & Corner Cases (>=5 per feature)
- Tier 3: Cross-Feature Interactions
- Tier 4: Real-World Scenarios (716-attendee bulk import, export, generation, and recovery)
