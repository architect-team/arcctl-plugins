# This dockerfile is used to build OpenTofu modules - the module files are copied in and terraform is installed
# so that the plugin can use terraform commands to plan/apply the module.
FROM alpine:3

RUN wget https://github.com/opentofu/opentofu/releases/download/v1.6.0-alpha1/tofu_1.6.0-alpha1_amd64.apk
RUN apk add --allow-untrusted tofu_1.6.0-alpha1_amd64.apk

COPY . .