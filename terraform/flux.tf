resource "flux_bootstrap_git" "this" {
  depends_on = [google_container_cluster.primary]

  embedded_manifests     = true
  path                   = "flux/clusters/production"
  components_extra       = ["image-reflector-controller", "image-automation-controller"]
  kustomization_override = <<EOT
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ./flux-system
  - image-automation.yaml
  - ../../apps/trainbot
EOT
}
