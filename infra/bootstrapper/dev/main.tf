locals {
  bootstrapper_tags = merge(local.tags, {
    Source = "https://github.com/pagopa/aiepdf-poc/blob/main/infra/bootstrapper/dev"
  })
}

module "azure-DEV-DEVEX_core_values" {
  source  = "pagopa-dx/azure-core-values-exporter/azurerm"
  version = "~> 0.0"

  providers = {
    azurerm = azurerm.DEV-DEVEX
  }

  core_state = {
    resource_group_name  = "dx-d-itn-tfstate-rg-01"
    storage_account_name = "dxditntfstatest01"
    subscription_id      = "35e6e3b2-4388-470e-a1b9-ad3bc34326d1"
    container_name       = "terraform-state"
    key                  = "dx.core.dev.tfstate"
  }
}

module "azure-DEV-DEVEX_bootstrap" {
  source  = "pagopa-dx/azure-github-environment-bootstrap/azurerm"
  version = "~> 4.0"

  providers = {
    azurerm = azurerm.DEV-DEVEX
  }

  environment = merge(local.environment, local.azure_accounts.DEV-DEVEX)

  entraid_groups = {
    admins_object_id    = data.azuread_group.admins.object_id
    devs_object_id      = data.azuread_group.developers.object_id
    externals_object_id = data.azuread_group.externals.object_id
  }

  terraform_storage_account = {
    name                = "dxditntfstatest01"
    resource_group_name = "dx-d-itn-tfstate-rg-01"
  }

  repository = {
    owner = "pagopa"
    name  = "aiepdf-poc"
  }

  github_private_runner = {
    container_app_environment_id = module.azure-DEV-DEVEX_core_values.github_runner.environment_id
    labels = [
      "dev"
    ]
    key_vault = {
      name                = module.azure-DEV-DEVEX_core_values.common_key_vault.name
      resource_group_name = module.azure-DEV-DEVEX_core_values.common_key_vault.resource_group_name
      use_rbac            = true
    }
    use_github_app = true
  }

  private_dns_zone_resource_group_id = module.azure-DEV-DEVEX_core_values.network_resource_group_id
  opex_resource_group_id             = module.azure-DEV-DEVEX_core_values.opex_resource_group_id

  # The workload resources live in the resource group this module creates for
  # the repository, but the pipelines still touch the common one: the PostgreSQL
  # module writes the administrator password into the shared Key Vault, which
  # sits there.
  additional_resource_group_ids = [
    module.azure-DEV-DEVEX_core_values.common_resource_group_id,
  ]

  tags = local.bootstrapper_tags
}

# App Configuration deploy identity.
#
# `_release-appconfig-dev.yaml` imports settings with the App CD identity, and
# the App Configuration store disables local authentication and public network
# access: the identity therefore needs a data-plane role. The store lives in the
# repository resource group, so scope the grant there.
resource "azurerm_role_assignment" "app_cd_appconfig_data_owner" {
  provider = azurerm.DEV-DEVEX

  scope                = module.azure-DEV-DEVEX_bootstrap.resource_group.id
  role_definition_name = "App Configuration Data Owner"
  principal_id         = module.azure-DEV-DEVEX_bootstrap.identities.app.cd.principal_id
  description          = "Allow the aiepdf-poc App CD identity to import settings into App Configuration"
}

# Infra plan read access.
#
# The DX Infra CI custom roles do not cover Static Web Apps or App
# Configuration, but the Terraform provider refreshes both computed
# attributes on every plan (`staticSites/listSecrets` for the Static Web App
# deployment token, `configurationStores/listKeys` for the App Configuration
# access keys). The plan identity is Infra CI, so grant the read actions on the
# repository resource group where both resources live. Infra CD already has
# them through the broad `DX Infra CD Resource Groups` role.
resource "azurerm_role_assignment" "infra_ci_static_web_app_list_secrets" {
  provider = azurerm.DEV-DEVEX

  scope                = module.azure-DEV-DEVEX_bootstrap.resource_group.id
  role_definition_name = "PagoPA Static Web Apps List Secrets"
  principal_id         = module.azure-DEV-DEVEX_bootstrap.identities.infra.ci.principal_id
  description          = "Allow the aiepdf-poc Infra CI identity to refresh the Static Web App during Terraform plan"
}

resource "azurerm_role_assignment" "infra_ci_app_configuration_contributor" {
  provider = azurerm.DEV-DEVEX

  scope                = module.azure-DEV-DEVEX_bootstrap.resource_group.id
  role_definition_name = "App Configuration Contributor"
  principal_id         = module.azure-DEV-DEVEX_bootstrap.identities.infra.ci.principal_id
  description          = "Allow the aiepdf-poc Infra CI identity to refresh the App Configuration access keys during Terraform plan"
}
