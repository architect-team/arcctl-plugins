# Arcctl Module Plugins


## Build the plugin

Navigate to the plugin you want to use and use `npm run build` to create the necessary plugin image.
```sh
cd ./pulumi/
npm install
npm run build
```

## Testing the plugin

The plugin container can be run locally to test the `build` and `apply` functions. `IMAGE_NAME` will be either `arcctl-pulumi-plugin` or `arcctl-opentofu-plugin` depending on which plugin(s) have been built.

It's necessary to mount the path to the module you want to test, e.g. `/Users/you/module-plugin/test/tofu-modules/vpc`.

Rebuild the image with `npm run build` when making changes to test any modifications.

```sh
docker run -it -p 50051:50051 -v /var/run/docker.sock:/var/run/docker.sock -v /path/to/test/module:/path/to/test/module [IMAGE_NAME] sh -c "npm run dev"
```

Or in order to test without rebuilding the plugin's image, run a version of the following, where the `src` directories of the core and one of the specific plugins are mounted. Be sure to run this from the root of the repo. Changes will hot-reload using nodemon.

```sh
docker run -it -p 50051:50051 -v /var/run/docker.sock:/var/run/docker.sock -v ./pulumi:/app -v ./core:/core -v /home/ryan/Code/gcp-pulumi-modules:/home/ryan/Code/gcp-pulumi-modules arcctl-pulumi-plugin sh -c "npm run dev"
```

### Running test requests

Once the server is running, the `/ws` endpoint can be used to send requests to the plugin. The default port used is `50051`, so the test URL will be something like: `0.0.0.0:50051/ws`. Websocket requests can be tested using [Postman](https://www.postman.com/) or any other tool you're comfortable with.

#### Sample build request message

The build command is used to build a module with the plugin. This request takes the directory where the module is found, and will output the resulting image hash.
```json
{
  "command": "build",
  "request": {
    "directory": "/path/to/test/module"
  }
}
```

#### Sample apply request message

The apply command is used to execute the module, using any existing state and inputs passed through. A simple request where there is no prior state and no inputs would look like:
```json
{
  "command": "apply",
  "request": {
    "image": "2dad474b9d67d2e699fa6436a5fd133246460f044e3b6b9cf3fd8d392ec21269"
  }
}
```

### Running `arcctl` with a manually-started plugin

For ease of testing, commands can be run against a manually-started plugin. In order to instruct `arcctl` to use the manually-started plugin and not start one on its own, run the `deno` command with the prefix `DEV_PLUGIN_PORT=<port_number>` where `<port_number>` is the number of the port that the plugin was started on.
