terraform {
  backend "azurerm" {
    resource_group_name  = "dx-d-itn-tfstate-rg-01"
    storage_account_name = "dxditntfstatest01"
    container_name       = "terraform-state"
    key                  = "dx/aiepdf/resources/dev.tfstate"
    subscription_id      = "35e6e3b2-4388-470e-a1b9-ad3bc34326d1"
    use_azuread_auth     = true
  }
}
