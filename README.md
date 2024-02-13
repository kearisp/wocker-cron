# @wocker/cron

###### For docker-in-docker container


## Installation

```shell
npm install -g @wocker/cron
```


## Commands

### Setup crontab for container

```shell
ws-cron set <container> <crontab>
```


### Exec command in container


```shell
ws-cron exec -c=<container> <...args>
```


## Example

```shell
$ ws-cron set test-container "* * * * * bash -c 'echo \"Test\"'\r\n"
$ crontab -l
* * * * * ws-cron exec -c=test-container bash -c 'echo \"Test\"'
  
```
