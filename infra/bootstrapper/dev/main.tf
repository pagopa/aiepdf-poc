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