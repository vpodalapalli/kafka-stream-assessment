variable "namespace" {
  description = "Kubernetes namespace"
  default     = "kafka-stream-assessment"
}

variable "image" {
  description = "Docker image for stream processor"
  default     = "kafka-stream-processor:latest"
}

variable "kafka_broker" {
  description = "Kafka broker endpoint"
  default     = "kafka:9092"
}

variable "input_topic" {
  description = "Kafka input topic"
  default     = "input-topic"
}

variable "output_topic" {
  description = "Kafka output topic"
  default     = "output-topic"
}

variable "group_id" {
  description = "Kafka consumer group ID"
  default     = "stream-processor-group"
}
