# Service objectives

These are operating targets for a deployment, not measurements from a public hosted service.

| Signal | Objective | Measurement |
| --- | --- | --- |
| API availability | 99.9% non-5xx responses over 30 days | request counter at the ingress |
| API latency | 99% below 300 ms over 5 minutes | ingress/API histogram excluding streaming |
| Scheduler freshness | 99% of enabled monitors start within one configured interval plus 10 seconds | scheduled-at to started-at |
| Alert durability | no duplicate transition notification and no silently discarded failed delivery | delivery state and retry counters |

A monitor target being unavailable is a product result, not a Vigil service failure. Dashboards should separate target failures from API, worker, database, and notification-provider failures.
