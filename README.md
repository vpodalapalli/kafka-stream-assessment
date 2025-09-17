
# Kafka Stream Assessment (Node.js + Kubernetes + Terraform)

## Overview

This repository contains a Node.js Kafka stream processor that:
- consumes messages from an input Kafka topic,
- performs a simple tumbling-window aggregation (counts per key),
- publishes aggregated results to an output Kafka topic.

The project includes:
- `src/` — producer, consumer, processor, and startup script
- `Dockerfile` — production image
- `k8s/` — Kubernetes manifests for deployment (namespace, deployment, service)
- `terraform/` — Terraform skeleton to create a namespace & deployment via the Kubernetes provider
- `tests/` — unit test for the processor logic (Jest)
- `.github/workflows/ci.yml` — CI workflow to run tests

---

## Prerequisites (locally)

- Node.js 18+ installed
- npm (comes with Node.js)
- Docker & Docker Compose (for local Kafka) — or a running Kafka cluster reachable from your machine
- kubectl and Minikube (optional, for Kubernetes testing)
- Terraform 1.0+ (optional, for IaC)

---

## Quick local run (developer flow)

### 1. Clone & install dependencies
```bash
git clone <repo-url-or-extract-zip>
cd kafka-stream-assessment
npm install
```

> Note: `npm install` requires internet access to fetch dependencies (`kafkajs`, `pino`, `dotenv`, `jest`).

### 2. Start a local Kafka (docker-compose)
Create a `docker-compose.yml` (example below) and run it, or use your preferred Kafka setup.

```yaml
version: '2'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

Start it:
```bash
docker-compose up -d
```

Create topics (run inside the kafka container):
```bash
# find kafka container name (e.g., kafka)
docker ps
# create input topic
docker exec -it <kafka-container> bash -c "kafka-topics --create --topic input-topic --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1"
# create output topic
docker exec -it <kafka-container> bash -c "kafka-topics --create --topic output-topic --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1"
```

Alternatively, use `kafkacat` or other client tools to create topics and produce/consume messages.

### 3. Run the stream processor locally
Set environment variables and start the service:

```bash
export KAFKA_BROKERS=localhost:9092
export INPUT_TOPIC=input-topic
export OUTPUT_TOPIC=output-topic
export GROUP_ID=kafka-stream-processor-group
export WINDOW_MS=30000
export FLUSH_INTERVAL_MS=5000

npm start
# or
node src/index.js
```

Logs will show when the producer connects and consumer subscribes. The processor will flush aggregated counts every tumbling window (30s by default).

### 4. Produce test messages (quick ways)
From inside kafka container (console producer):
```bash
docker exec -it <kafka-container> bash -c "kafka-console-producer --broker-list localhost:9092 --topic input-topic"
> This will open stdin; type messages (press Enter to send).
```

If you want to send keyed messages use a small Node.js script (example):

```js
// scripts/send.js (example, create and run manually)
const { Kafka } = require('kafkajs');
(async () => {
  const kafka = new Kafka({ brokers: ['localhost:9092'] });
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({ topic: 'input-topic', messages: [{ key: 'a', value: '1' }, { key: 'a', value: '2' }, { key: 'b', value: '3' }] });
  await producer.disconnect();
})();
```

### 5. Verify output topic
Consume from `output-topic` to see aggregated JSON messages:

```bash
docker exec -it <kafka-container> bash -c "kafka-console-consumer --bootstrap-server localhost:9092 --topic output-topic --from-beginning --max-messages 10"
```

---

## Tests

Unit test (Jest) is included in `tests/processor.test.js`.

Run tests:
```bash
npm test
```

Note: you must run `npm install` first (network required). The tests validate the aggregator logic in isolation (it uses a fake producer), so they should run quickly after installing dev dependencies.

---

## Dockerizing

Build the Docker image:
```bash
docker build -t myorg/kafka-stream-processor:latest .
```

Run the container (point it to your Kafka):
```bash
docker run --env KAFKA_BROKERS=host.docker.internal:9092 --env INPUT_TOPIC=input-topic --env OUTPUT_TOPIC=output-topic myorg/kafka-stream-processor:latest
```

> On Linux, replace `host.docker.internal` with the host's IP or the broker endpoint reachable from the container.

---

## Kubernetes (Minikube) — local deploy

1. Start minikube:
```bash
minikube start --driver=docker
```

2. Build image into minikube's Docker registry:
```bash
eval $(minikube -p minikube docker-env)
docker build -t kafka-stream-processor:latest .
# or use minikube image load on newer versions:
minikube image load kafka-stream-processor:latest
```

3. Edit `k8s/deployment.yaml` to set `image: kafka-stream-processor:latest` and appropriate `KAFKA_BROKERS` (if Kafka is also deployed inside the cluster use the cluster service name).

4. Apply manifests:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml -n kafka-stream
kubectl apply -f k8s/service.yaml -n kafka-stream
```

5. Check logs:
```bash
kubectl logs -l app=kafka-stream-processor -n kafka-stream -f
```

Add readiness/liveness probes or a small HTTP health endpoint if you need Kubernetes to manage lifecycle more reliably.

---

## Terraform (skeleton)

The `terraform/` directory contains an example using the Kubernetes provider to create a namespace and deployment. To use:

```bash
cd terraform
terraform init
terraform plan -var="kubeconfig_path=$HOME/.kube/config" -var="image=myorg/kafka-stream-processor:latest"
terraform apply -var="kubeconfig_path=$HOME/.kube/config" -var="image=myorg/kafka-stream-processor:latest"
```

Adjust provider auth and values to match your environment. This is a starting point (not a full production IaC).

---

## Troubleshooting & Tips

- If the consumer fails to connect, confirm `KAFKA_BROKERS` is reachable from where the app runs.
- If using Docker on Mac/Windows, prefer `host.docker.internal:9092` for containers to reach local brokers.
- For production use, enable SASL/SSL and provide Kafka credentials through Kubernetes secrets.
- The processor keeps window state in memory — on restart it will lose in-flight counts. For production, use a persistent state store or Kafka Streams with RocksDB.

---

## Next steps / enhancements

- Add an HTTP metrics/health endpoint for liveness/readiness probes in Kubernetes.
- Persist windowed state to a durable store (Redis, RocksDB) to tolerate restarts.
- Add integration tests using testcontainers' Kafka or a local ephemeral Kafka cluster.
- Add more advanced windowing (sliding/session windows) or joins with other topics.

---

If you'd like, I can also:
- add the `docker-compose.yml` and the small `scripts/send.js` producer into the repo,
- add a small HTTP health endpoint to the Node.js app,
- or attempt to run unit tests and provide logs if you provide an environment with network access.

## Run with Docker-compose file

The repo includes a docker-compose.yml file that runs Zookeeper, Kafka, and the Stream Processor.

1. Start services
docker-compose up --build -d

2. Verify running containers
docker ps


You should see containers for:

zookeeper

kafka

stream-processor

3. Create Kafka topics (inside Kafka container)
docker exec -it <kafka-container-name> bash
kafka-topics --create --topic input-topic --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
kafka-topics --create --topic output-topic --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
exit

4. Produce messages into input topic
docker exec -it <kafka-container-name> bash -c "kafka-console-producer --broker-list localhost:9092 --topic input-topic"
> {\"id\":1,\"value\":10}
> {\"id\":2,\"value\":20}

5. Consume from output topic
docker exec -it <kafka-container-name> bash -c "kafka-console-consumer --bootstrap-server localhost:9092 --topic output-topic --from-beginning --max-messages 10"

6. Stop services
docker-compose down

Manual local run (without Compose)

If you already have Kafka running locally:

Export environment variables:

export KAFKA_BROKERS=localhost:9092
export INPUT_TOPIC=input-topic
export OUTPUT_TOPIC=output-topic
export GROUP_ID=kafka-stream-processor-group
export WINDOW_MS=30000
export FLUSH_INTERVAL_MS=5000


Start the app:

npm start
# or
node src/index.js

Tests

Unit test (Jest) is included in tests/processor.test.js.

Run tests:

npm test

Dockerizing

Build the Docker image:

docker build -t myorg/kafka-stream-processor:latest .


Run the container (point it to your Kafka):

docker run --env KAFKA_BROKERS=host.docker.internal:9092 \
           --env INPUT_TOPIC=input-topic \
           --env OUTPUT_TOPIC=output-topic \
           myorg/kafka-stream-processor:latest

Kubernetes (Minikube)

Start minikube:

minikube start --driver=docker


Build and load image:

eval $(minikube -p minikube docker-env)
docker build -t kafka-stream-processor:latest .
minikube image load kafka-stream-processor:latest


Apply manifests:

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml -n kafka-stream
kubectl apply -f k8s/service.yaml -n kafka-stream


Check logs:

kubectl logs -l app=kafka-stream-processor -n kafka-stream -f

Terraform
cd terraform
terraform init
terraform plan -var="kubeconfig_path=$HOME/.kube/config" -var="image=myorg/kafka-stream-processor:latest"
terraform apply -var="kubeconfig_path=$HOME/.kube/config" -var="image=myorg/kafka-stream-processor:latest"

Troubleshooting

Use host.docker.internal on Mac/Windows for containers to reach Kafka running on the host.

The processor stores state in memory; restart clears counts. For production, persist state externally.

Configure SASL/SSL for secure Kafka clusters.

Enhancements

Add HTTP health endpoint

Persist state in RocksDB/Redis

Add integration tests with ephemeral Kafka

Expand to sliding/session windows


---

If you want, I can **also provide a ready-to-download ZIP** of the repo including this updated README and all folder skeletons (`k8s/`, `terraform/`, `src/`, `tests/`, `.github/`).  

Do you want me to create that ZIP for you?
