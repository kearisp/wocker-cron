import {promises as FS, existsSync} from "fs";
import * as OS from "os";
import {Cli} from "@kearisp/cli";
import * as Docker from "dockerode";

import {DATA_DIR, CONFIG_PATH} from "./env";
import {Job} from "./makes/Job";
import {Watcher} from "./makes/Watcher";
import {exec} from "./utils/exec";
import {spawn} from "./utils/spawn";


type SetOptions = {};

type ExecOptions = {
    container?: string;
};

export class App {
    protected cli: Cli;
    protected docker: Docker;

    public constructor() {
        this.cli = new Cli();
        this.docker = new Docker({
            socketPath: "/var/run/docker.sock"
        });

        this.cli.command("watch")
            .action(() => this.watch());

        this.cli.command("process")
            .action(() => this.process());

        this.cli.command("set <container> <crontab>")
            .action((options, container, crontab) => this.set(options, container as string, crontab as string));

        this.cli.command("exec <...args>")
            .option("container", {
                type: "string",
                alias: "c",
                description: "Container name"
            })
            .action((options, args) => this.exec(options, args as string[]));
    }

    protected async watch() {
        const watcher = new Watcher(__dirname);

        await watcher.watch();
    }

    protected async process() {
        // exec("cron -f").then(() => {
        //     console.log(">_<");
        // }).catch((err) => {
        //     console.log(err.message);
        // });

        const stream = await this.docker.getEvents({
            since: Math.floor(1707684645107 / 1000),
            filters: JSON.stringify({
                event: ["start", "stop"]
            })
        });

        stream.on("data", async (data) => {
            const {
                Action: action,
                Actor: {
                    Attributes: {
                        name
                    }
                }
            } = JSON.parse(data.toString());

            console.log(action, name);

            if(action === "start") {
                await this.startJobs(name);
            }
            else if(action === "stop") {
                await this.stopJobs(name);
            }

            // await this.updateCrontabV2();
        });
    }

    protected async set(options: SetOptions, container: string, crontab: string) {
        const data = await this.getConfig();

        data[container] = crontab;

        await this.setConfig(data);
        await this.updateCrontab();

        return "";
    }

    protected async exec(options: ExecOptions, args: string[]) {
        const {container: name} = options;

        if(!name) {
            return;
        }

        args = args.map((arg) => {
            return arg.replace(/\\\$/, "$");
        });

        console.log(name, args);

        const container = this.docker.getContainer(name);

        if(!container) {
            return;
        }

        const exec = await container.exec({
            Cmd: args,
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({
            Tty: false
        });

        container.modem.demuxStream(stream, process.stdout, process.stderr);
    }

    protected async getConfig() {
        if(!existsSync(CONFIG_PATH)) {
            return {};
        }

        try {
            const data = await FS.readFile(CONFIG_PATH);

            return JSON.parse(data.toString());
        }
        catch(err) {
            return {};
        }
    }

    protected async setConfig(data: any) {
        if(!existsSync(DATA_DIR)) {
            await FS.mkdir(DATA_DIR, {
                recursive: true
            });
        }

        await FS.writeFile(CONFIG_PATH, JSON.stringify(data, null, 4));
    }

    protected async updateCrontab() {
        const data = await this.getConfig();
        const containers = await this.docker.listContainers();

        let crontab = "";

        for(const name in data) {
            const container = containers.find((container) => {
                return container.Names.includes(`/${name}`);
            });

            if(!container) {
                continue;
            }

            crontab += (data[name] as string).split(/\r?\n/).filter((job) => {
                return !!job;
            }).map((cron: string) => {
                const job = Job.fromString(cron);
                const command = job.command.replace(/\$/, "\\$");

                job.command = `$(bash -i which node) $(bash -i which ws-cron) exec -c=${name} ${command} >> /var/log/cron.log 2>> /var/log/cron.log`;

                return job.toString();
            }).join(OS.EOL);
        }

        await FS.writeFile("./crontab.txt", crontab + OS.EOL);
        await exec("crontab ./crontab.txt");
        await FS.rm("./crontab.txt");
    }

    protected async updateCrontabV2() {
        // const containers = await this.docker.listContainers();

        let crontab = await exec("crontab -l");
        let jobs = crontab.split(/\r?\n/).filter((job) => {
            return !!job;
        }).map((job) => {
            return Job.fromString(job);
        }).filter((job) => {
            return !/ws-cron/.test(job.command);
        });

        // const config = await this.getConfig();
        //
        // for(const name in config) {
        //     const containerJobs = config[name].split(/\r?\n/).filter((job: string) => !!job).map((job: string) => {
        //         return Job.fromString(job);
        //     });
        //
        //     console.log(name, containerJobs);
        // }

        console.log(jobs.map(job => job.command));
    }

    protected async startJobs(name: string) {
        let crontab = await exec("crontab -l");
        let jobs = crontab.split(/\r?\n/).filter((job) => !!job).map((job) => {
            return Job.fromString(job);
        }).filter((job) => {
            return !new RegExp(`-c=${name}`).test(job.command);
        });

        console.log(jobs);
    }

    protected async stopJobs(name: string) {

    }

    public async run(args: string[]) {
        try {
            const res = await this.cli.run(args);

            if(res) {
                process.stdout.write(res);
                process.stdout.write("\n");
            }
        }
        catch(err) {
            process.stderr.write((err as Error).message);
            process.stderr.write("\n");
        }
    }
}
