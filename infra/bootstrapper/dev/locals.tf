locals {
  environment = {
    prefix          = "dx"
    env_short       = "d"
    domain          = "aiepdf"
    instance_number = "01"
  }

  azure_accounts = {
    DEV-DEVEX = {
      location = "italynorth"
    }
  }

  tags = {
    CreatedBy      = "Terraform"
    Environment    = "Dev"
    BusinessUnit   = "dx"
    CostCenter     = "TS000"
    ManagementTeam = "dx"
  }
}