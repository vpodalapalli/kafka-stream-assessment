# Configure Kubernetes provider (uses local kubeconfig)
provider "kubernetes" {
  config_path = "~/.kube/config"
}

# Namespace for the app
resource "kubernetes_namespace" "kafka_stream_ns" {
  metadata {
    name = var.namespace
  }
}

# Deployment for stream processor
resource "kubernetes_deployment" "stream_processor" {
  metadata {
    name      = "stream-processor"
    namespace = kubernetes_namespace.kafka_stream_ns.metadata[0].name
    labels = {
      app = "stream-processor"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "stream-processor"
      }
    }

    template {
      metadata {
        labels = {
          app = "stream-processor"
        }
      }

      spec {
        container {
          name  = "stream-processor"
          image = var.image

          image_pull_policy = "IfNotPresent"

          env {
            name  = "KAFKA_BROKER"
            value = var.kafka_broker
          }

          env {
            name  = "INPUT_TOPIC"
            value = var.input_topic
          }

          env {
            name  = "OUTPUT_TOPIC"
            value = var.output_topic
          }

          env {
            name  = "GROUP_ID"
            value = var.group_id
          }

          port {
            container_port = 3000
          }
        }
      }
    }
  }
}

# Service for stream processor
resource "kubernetes_service" "stream_processor_service" {
  metadata {
    name      = "stream-processor-service"
    namespace = kubernetes_namespace.kafka_stream_ns.metadata[0].name
  }

  spec {
    selector = {
      app = "stream-processor"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }

    type = "ClusterIP"
  }
}
