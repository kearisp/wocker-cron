import {existsSync} from "fs";
import * as OS from "os";
import * as Path from "path";
import {FS} from "@wocker/core";
import {demuxOutput} from "@wocker/utils";
import {Cli, CommandInput} from "@kearisp/cli";
import * as Docker from "dockerode";

import {DATA_DIR, CONFIG_PATH} from "./env";
import {Crontab} from "./makes/Crontab";
import {Job} from "./makes/Job";
import {Logger} from "./makes/Logger";
import {Watcher} from "./makes/Watcher";
import {exec} from "./utils/exec";
import {spawn} from "./utils/spawn";


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

        this.cli.command("edit [filename]")
            .option("container", {
                type: "string",
                alias: "c",
                description: "Container name"
            })
            .action((input: CommandInput) => {
                return this.edit(input.option("container"), input.argument("filename") as string);
            });

        this.cli.command("exec <...args>")
            .option("container", {
                type: "string",
                alias: "c",
                description: "Container name"
            })
            .action((input: CommandInput) => {
                return this.exec(input.argument("args") as unknown as string[], input.option("container"));
            });
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

            await this.update();
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

    protected async edit(container: string, filename: string): Promise<void> {
        if(!container) {
            console.log("Required -c=<container>");
            return;
        }

        if(process.stdin.isTTY) {
            const filePath = Path.join(OS.tmpdir(), "ws-crontab.txt");
            const crontab = await this.getCrontab(container);

            await FS.writeFile(filePath, crontab);
            await spawn("sensible-editor", [filePath]);

            const res = await FS.readFile(filePath);
            await FS.rm(filePath);

            if(res.toString() === crontab) {
                return;
            }

            await this.setCrontab(container, res.toString());
            await this.update();
        }
        else {
            const crontab: string = await new Promise((resolve, reject) => {
                let res = "";

                process.stdin.on("data", (data) => {
                    res += data.toString();
                });

                process.stdin.on("end", () => {
                    resolve(res);
                });

                process.stdin.on("error", reject);
            });

            await this.setCrontab(container, crontab);
            await this.update();
        }
    }

    protected async exec(args: string[], name: string): Promise<void> {
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

    protected async getCrontab(name: string): Promise<string> {
        const {
            [name]: crontab = ""
        } = await this.getConfig();

        return crontab;
    }

    protected async setCrontab(name: string, crontab: string): Promise<void> {
        await this.setConfig({
            ...await this.getConfig(),
            [name]: crontab
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
