FROM docker:dind

WORKDIR /app

RUN apk update && apk add nodejs npm

RUN wget https://get.pulumi.com/releases/sdk/pulumi-v3.78.1-linux-x64.tar.gz && \
  mkdir -p /tmp/pulumi && \
  tar zxf /app/pulumi-v3.78.1-linux-x64.tar.gz -C /tmp/pulumi && \
  mkdir -p /app/.pulumi/bin && \
  cp /tmp/pulumi/pulumi/* /app/.pulumi/bin/
ENV PATH=$PATH:/app/.pulumi/bin/

# TODO: When core is published to npm, don't need to copy this way and use build context ".."
COPY core/ /core
RUN cd /core && npm run ci && npm run build && cd /app

COPY pulumi/ .

RUN npm ci

CMD [ "npm", "run", "start" ]
