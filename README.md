# @wocker/cron

###### For docker-in-docker container

> ⚠ **Deprecated.** This package is no longer maintained. Starting version 1.0.4, the "[rproxy](https://www.npmjs.com/package/@wocker/cron-plugin)" plugin will work without this package.


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
