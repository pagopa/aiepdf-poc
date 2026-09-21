locals {
  environment = {
    prefix          = "dx"
    env_short       = "d"
    location        = "italynorth"
    domain          = "aiepdf"
    app_name        = "adhesion"
    instance_number = "01"
  }

  core_state = {
    resource_group_name  = "dx-d-itn-tfstate-rg-01"
    storage_account_name = "dxditntfstatest01"
    container_name       = "terraform-state"
    subscription_id      = "35e6e3b2-4388-470e-a1b9-ad3bc34326d1"
    key                  = "dx.core.dev.tfstate"
  }

  # Private blob container holding the confidential adhesion agreements.
  agreement_container_name = "agreements"

  postgres = {
    # Administrator login name (not a secret).
    admin_username         = "adhesionpgadmin"
    admin_password_version = 1
    # Application database, created by the migrations (`contracts.item-002`).
    database_name = "adhesion"
  }

  tags = {
    BusinessUnit   = "dx"
    CostCenter     = "TS000"
    CreatedBy      = "Terraform"
    Environment    = "Dev"
    ManagementTeam = "dx"
    Source         = "https://github.com/pagopa/aiepdf-poc/blob/main/infra/resources/dev"
  }
}
