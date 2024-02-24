import {promises as FS, existsSync} from "fs";
import {Cli} from "@kearisp/cli";
import * as Docker from "dockerode";

import {DATA_DIR, CONFIG_PATH} from "./env";
import {Crontab} from "./makes/Crontab";
import {Job} from "./makes/Job";
import {Logger} from "./makes/Logger";
import {Watcher} from "./makes/Watcher";
import {exec} from "./utils/exec";
import {demuxOutput} from "./utils/demuxOutput";


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

        this.cli.command("update")
            .action(() => this.update());

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
        await this.update();

        const abortController = new AbortController();

        const stream = await this.docker.getEvents({
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
        });

        process.on("exit", () => {
            abortController.abort();
        });
    }

    protected async update() {
        const data = await this.getConfig();
        const containers = await this.docker.listContainers();

        const crontab = Crontab.fromString(await exec("crontab -l").catch(() => ""));

        crontab.filter((job) => {
            return !/ws-cron/.test(job.command);
        });

        for(const name in data) {
            const container = containers.find((container) => {
                return container.Names.includes(`/${name}`);
            });

            if(!container) {
                continue;
            }

            const containerCrontab = Crontab.fromString(data[name]);

            containerCrontab.jobs = containerCrontab.jobs.map((job) => {
                const command = job.command.replace(/\$/, "\\$");

                job.command = `ws-cron exec -c=${name} ${command}`;

                return job;
            });

            crontab.push(...containerCrontab.jobs);
        }

        if(crontab.jobs.length === 0) {
            crontab.push(Job.fromString("* * * * * ws-cron exec echo \"No jobs\""));
        }

        await FS.writeFile("./crontab.txt", crontab.toString());
        await exec("crontab ./crontab.txt");
        await FS.rm("./crontab.txt");
    }

    protected async set(options: SetOptions, container: string, crontab: string) {
        const data = await this.getConfig();

        data[container] = crontab;

        await this.setConfig(data);
        await this.update();

        return "";
    }

    protected async exec(options: ExecOptions, args: string[]) {
        const {
            container: name
        } = options;

        if(!name) {
            const res = await exec(args.join(" "));
            const data = res.toString()
                .replace(/\n$/, "")
                .split(/\n/);

            for(const line of data) {
                Logger.log(`cron`, line);
            }
            return;
        }

        const container = this.docker.getContainer(name);

        if(!container) {
            return;
        }

        args = args.map((arg) => {
            return arg.replace(/\\\$/, "$");
        });

        const containerExec = await container.exec({
            Cmd: args,
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await containerExec.start({
            Tty: false
        });

        stream.on("data", (chunk) => {
            const data = demuxOutput(chunk).toString().replace(/\n$/, "").split(/\n/);

            for(const line of data) {
                Logger.log(`cron:${name}`, line);
            }
        });
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

    protected async startJobs(name: string) {
        const {
            [name]: containerCrontab = ""
        } = await this.getConfig();

        const crontab = Crontab.fromString(await exec("crontab -l").catch(() => ""));

        crontab.filter((job) => {
            return /^\* \* \* \* \* ws-cron exec echo "[^"]+"$/.test(job.command);
        }).filter((job) => {
            return !new RegExp(`ws-cron exec -c=${name}`).test(job.command);
        });

        const cc = Crontab.fromString(containerCrontab);

        cc.jobs.map((job) => {
            const command = job.command.replace(/\$/, "\\$");

            job.command = `ws-cron exec -c=${name} ${command} `;

            return job;
        });

        crontab.jobs.push(...cc.jobs);

        if(crontab.jobs.length === 0) {
            crontab.push(Job.fromString("* * * * * ws-cron exec echo \"No jobs\""));
        }

        await FS.writeFile("./crontab.txt", crontab.toString());
        await exec("crontab ./crontab.txt");
        await FS.rm("./crontab.txt");
    }

    protected async stopJobs(name: string) {
        try {
            const cron = Crontab.fromString(await exec("crontab -l"));

            cron.filter((job) => !new RegExp(`-c=${name}`).test(job.command));

            if(cron.jobs.length === 0) {
                cron.push(Job.fromString("* * * * * ws-cron exec echo \"No jobs\""));
            }

            await FS.writeFile("./crontab.txt", cron.toString());
            await exec("crontab ./crontab.txt");
            await FS.rm("./crontab.txt");
        }
        catch(err) {
            console.error(err);
        }
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
