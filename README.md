# PLY Indexer

A microservices based indexer to provide data to plenty network. 

## Steps to run

### Sample .env file

```
POSTGRES_PASSWORD=123456
POSTGRES_USER=master
POSTGRES_DB=plenty
POSTGRES_HOST=db

SHARED_DIRECTORY=/app/data
```

### Run command

```shell
docker-compose up --build -d
```
