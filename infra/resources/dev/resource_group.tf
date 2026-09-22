# Resource group dedicated to this repository.
#
# The bootstrapper (`infra/bootstrapper/dev`) creates it together with the
# identities and the private runner, so every workload resource lives here.
# Only the shared core stays in the environment resource groups managed by the
# core infrastructure: Key Vault, Log Analytics workspace, virtual network and
# private DNS zones (common and network resource groups).
data "azurerm_resource_group" "workload" {
  # The naming function refuses a resource whose `name` also matches `domain`,
  # and `local.environment` carries both keys for the workload modules.
  name = provider::azuredx::resource_name(merge(
    { for key, value in local.environment : key => value if !contains(["app_name", "domain"], key) },
    {
      name          = local.environment.domain
      resource_type = "resource_group"
    }
  ))
}
