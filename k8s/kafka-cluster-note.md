# Kafka Cluster Setup Note

This project assumes an existing Kafka cluster.  
For local testing in Minikube, you can deploy Kafka using:

- [Strimzi Kafka Operator](https://strimzi.io)
- Bitnami Helm chart for Kafka:  
  ```bash
  helm repo add bitnami https://charts.bitnami.com/bitnami
  helm install kafka bitnami/kafka --namespace kafka-stream-assessment
