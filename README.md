# @wocker/cron

###### For docker-in-docker container


## Installation

```shell
npm install -g @wocker/cron
```


## Commands

### Edit crontab for container

This command will open your editor:

```shell
ws-cron edit -c=<container>
```


### Exec command in container

```shell
ws-cron exec -c=<container> <...args>
```


## Example

```shell
$ echo -e "* * * * * bash -c 'echo \"Test\"'\n" | ws-cron edit -c=test-container
$ crontab -l
* * * * * ws-cron exec -c=test-container bash -c 'echo \"Test\"'
```
