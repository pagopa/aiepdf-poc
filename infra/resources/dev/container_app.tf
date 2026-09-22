# adhesion-api container app.
#
# Secrets are never written as literals: both entries reference versionless Key
# Vault secrets managed outside or by sibling modules. Non-secret runtime values
# are exposed as plain environment variables.
module "container_app" {
  source  = "pagopa-dx/azure-container-app/azurerm"
  version = "~> 7.0"

  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.workload.name
  use_case            = "development"

  container_app_environment_id       = module.container_app_environment.id
  container_port                     = 3000
  allow_access_from_environment_only = false # external ingress: called from the browser

  # Multiple revision mode, so the release workflow performs a canary rollout
  # driven by `canary-monitor.sh` at the repository root (see DX docs).
  deployment_strategy = "Incremental"

  containers = [
    {
      image = "ghcr.io/pagopa/aiepdf-poc:latest"
      name  = "adhesion-api"

      app_settings = {
        NODE_ENV                    = "production"
        PERSISTENCE                 = "postgres"
        STORAGE                     = "azure"
        APP_CONFIG_ENDPOINT         = module.app_configuration.endpoint
        AZURE_STORAGE_BLOB_ENDPOINT = module.storage_account.primary_blob_endpoint
        AZURE_STORAGE_CONTAINER     = local.agreement_container_name
        POSTGRES_HOST               = "${module.postgres.postgres.name}.postgres.database.azure.com"
        POSTGRES_USER               = local.postgres.admin_username
        POSTGRES_DB                 = local.postgres.database_name
        # The UI is served by the Static Web App and calls the API from the
        # browser, so its origin must be allowed by CORS.
        CORS_ALLOWED_ORIGINS = "https://${azurerm_static_web_app.this.default_host_name}"
      }

      secret_names = [
        "POSTGRES_ADMIN_PASSWORD",
        "APPLICATIONINSIGHTS_INSTRUMENTATION_KEY",
      ]

      liveness_probe = {
        path = "/health"
      }

      readiness_probe = {
        path = "/ready"
      }

      # Migrations run before the server listens; the startup probe tolerates the
      # first boot without restarting the revision.
      startup_probe = {
        path = "/health"
      }
    },
  ]

  secrets = [
    {
      name                = "POSTGRES_ADMIN_PASSWORD"
      key_vault_secret_id = module.postgres.admin_password_secret.versionless_id
    },
    {
      name                = "APPLICATIONINSIGHTS_INSTRUMENTATION_KEY"
      key_vault_secret_id = module.azure_core_values.application_insights.instrumentation_key_kv_secret_id
    },
  ]

  log_analytics_workspace_id = module.azure_core_values.common_log_analytics_workspace.id

  tags = local.tags
}
