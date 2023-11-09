# This dockerfile is used to build OpenTofu modules - the module files are copied in and terraform is installed
# so that the plugin can use terraform commands to plan/apply the module.
FROM alpine:3

# Needed for terraform modules that include a remote source
RUN apk add --no-cache git

RUN wget https://github.com/opentofu/opentofu/releases/download/v1.6.0-alpha3/tofu_1.6.0-alpha3_amd64.apk
RUN apk add --allow-untrusted tofu_1.6.0-alpha3_amd64.apk

COPY . .