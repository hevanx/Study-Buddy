FROM node:18-alpine
RUN  mkdir -p /study-buddy


COPY . . 

EXPOSE  80
