variable "region" {
  type = string
  description = "Region for this infrastructure"
  default = "nyc3"
}

variable "name" {
  type = string
  description = "Name for this infrastructure"
  default = "meat-test"
}

variable "do_token" {
  type = string
  description = "digitalocean template"
  default = "INSERT_TOKEN_HERE"
}