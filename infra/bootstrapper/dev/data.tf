data "azuread_group" "admins" {
  display_name = "dx-d-aiepdf-adgroup-admin"
}

data "azuread_group" "developers" {
  display_name = "dx-d-aiepdf-adgroup-developers"
}

data "azuread_group" "externals" {
  display_name = "dx-d-aiepdf-adgroup-externals"
}