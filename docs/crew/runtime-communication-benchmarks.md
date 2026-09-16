# Runtime communication benchmarks

## Metrics

| Metric                                | SDK | Fabric |
| ------------------------------------- | --- | ------ |
| System prompt estimate                |     |        |
| Tool-schema estimate                  |     |        |
| Tool-call estimate                    |     |        |
| Tool-result estimate                  |     |        |
| Context after                         |     |        |
| Provider input/output/reasoning/cache |     |        |
| Wall time                             |     |        |
| Message latency                       |     |        |

## Test 1 — one-shot multi-agent communication

```text
A starts → emits marker to B → A exits
B starts → receives marker → writes marker → B exits
```

| Metric                                | SDK | Fabric |
| ------------------------------------- | --- | ------ |
| System prompt estimate                |     |        |
| Tool-schema estimate                  |     |        |
| Tool-call estimate                    |     |        |
| Tool-result estimate                  |     |        |
| Context after                         |     |        |
| Provider input/output/reasoning/cache |     |        |
| Wall time                             |     |        |
| Message latency                       |     |        |

## Test 2 — resident agent communication

```text
Main → resident worker → reply → Main
```

| Metric                                | SDK | Fabric |
| ------------------------------------- | --- | ------ |
| System prompt estimate                |     |        |
| Tool-schema estimate                  |     |        |
| Tool-call estimate                    |     |        |
| Tool-result estimate                  |     |        |
| Context after                         |     |        |
| Provider input/output/reasoning/cache |     |        |
| Wall time                             |     |        |
| Message latency                       |     |        |
