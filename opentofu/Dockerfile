FROM docker:dind

WORKDIR /app

RUN apk update && apk add nodejs npm

# TODO: When core is published to npm, don't need to copy this way and use build context ".."
COPY core/ /core
COPY opentofu/ .

RUN npm ci

CMD [ "npm", "run", "start" ]
