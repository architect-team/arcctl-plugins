FROM alpine:3

RUN apk add terraform --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community

COPY . .