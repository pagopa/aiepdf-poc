data "azuread_group" "admins" {
  display_name = "dx-d-adgroup-admin"
}

data "azuread_group" "developers" {
  display_name = "dx-d-adgroup-developers"
}

data "azuread_group" "externals" {
  display_name = "dx-d-adgroup-externals"
}