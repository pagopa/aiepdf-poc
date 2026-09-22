# Azure Static Web App hosting the Next.js UI.
#
# No pagopa-dx module exists for Azure Static Web Apps, so the raw azurerm
# resource is used here, mirrored from the DX reference implementation in
# infra/resources/_modules/dx_website. Static Web Apps are not available in the
# italynorth region, so the resource is pinned to westeurope.
resource "azurerm_static_web_app" "this" {
  name = provider::azuredx::resource_name(merge(local.environment, {
    app_name      = "adhesion-web"
    resource_type = "static_web_app"
  }))
  resource_group_name = data.azurerm_resource_group.workload.name
  location            = "westeurope"
  sku_size            = "Standard"
  sku_tier            = "Standard"

  tags = local.tags

  lifecycle {
    # The deployment pipeline connects the repository to the Static Web App.
    ignore_changes = [
      repository_branch,
      repository_url,
    ]
  }
}
