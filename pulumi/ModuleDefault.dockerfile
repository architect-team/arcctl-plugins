# This dockerfile is used to build Pulumi modules - the module files are copied in 
# so that the plugin can use pulumi commands to plan/apply the module.
FROM pulumi/pulumi-base

COPY . .
