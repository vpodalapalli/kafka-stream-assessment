output "namespace" {
  value = kubernetes_namespace.kafka_stream_ns.metadata[0].name
}

output "deployment_name" {
  value = kubernetes_deployment.stream_processor.metadata[0].name
}
