# Arcctl Module Plugins

<!--
## Building the image

```sh
docker build . -t pulumi
```

## Running the container in dev mode

Includes hot reloading. Note that the paths of the second volume will need to be
changed.

```sh
docker run -it -p 50051:50051 -v /var/run/docker.sock:/var/run/docker.sock -v ./src:/app/src -v /home/ryan/Code/arcctl-build-modules/test/yaml:/home/ryan/Code/arcctl-build-modules/test/yaml pulumi sh -c "npm run dev"
```

## Running the container in prod mode

Note that the path of the second volume will need to be changed.

```sh
docker run -it -p 50051:50051 -v /var/run/docker.sock:/var/run/docker.sock -v /home/ryan/Code/arcctl-build-modules/test/yaml:/home/ryan/Code/arcctl-build-modules/test/yaml pulumi sh -c "npm run start"
```

## Running Postman requests against the container

Make sure that the container has started and prints out something like
`Started server on port 50051`. In Postman, create a new gRPC request and set
the URL to `0.0.0.0:50051`. On the "Service definition" tab, select "Import a
.proto file" and select `arcctlpulumi.proto` from the `proto` folder of this
repo. Then to the right of the URL, select either the "Build" or "Apply" method.

### Sample build request message

```json
{
  "directory": "/home/ryan/Code/arcctl-build-modules/test/typescript"
}
```

### Sample apply request message (pulumi up)

```json
{
  "datacenterid": "datacenter-id",
  "image": "1a036239d7feee5b44e23e99458120823fe70c3aea474ab2bd95f7f7216626e7",
  "inputs": {
    "aws:region": "<your preferred AWS region>",
    "aws:accessKey": "<your AWS access key>",
    "aws:secretKey": "<your AWS secret key>",
    "world_text": "Architect"
  }
}
```

### Sample apply request message (pulumi destroy)

```json
{
  "datacenterid": "datacenter-id",
  "image": "1a036239d7feee5b44e23e99458120823fe70c3aea474ab2bd95f7f7216626e7",
  "inputs": {
    "aws:region": "<your preferred AWS region>",
    "aws:accessKey": "<your AWS access key>",
    "aws:secretKey": "<your AWS secret key>",
    "world_text": "Architect"
  },
  "pulumistate": {
    ...
  },
  "destroy": true
}
```

docker run -it -p 50051:50051 -v /var/run/docker.sock:/var/run/docker.sock -v /Users/tyler/code/architect/module-plugin/test/tofu-modules/vpc:/Users/tyler/code/architect/module-plugin/test/tofu-modules/vpc opentofu sh -c "npm run start"


{
    "command": "build",
    "request": {"directory": "/Users/tyler/code/architect/module-plugin/test/tofu-modules/vpc"}
}

{
    "command": "apply",
    "request": {"image": "4a69e4300fa041de5744a44f6eecbc0e3e3e3d30ba352631c08341f872cedb60"}
}
-->