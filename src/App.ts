import {promises as FS, existsSync} from "fs";
import OS from "os";
import {Cli} from "@kearisp/cli";
import Docker from "dockerode";

import {Job} from "./makes/Job";
import {exec} from "./utils/exec";
import {CONFIG_PATH} from "./env";


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
        await FS.writeFile(CONFIG_PATH, JSON.stringify(data, null, 4));
    }

    protected async updateCrontab() {
        const data = await this.getConfig();

        let crontab = "";

        for(const container in data) {
            crontab += (data[container] as string).split(/\r?\n/).filter((job) => {
                return !!job;
            }).map((cron: string) => {
                const job = Job.fromString(cron);
                const command = job.command.replace(/\$/, "\\$");

                job.command = `$(bash -i which node) $(bash -i which ws-cron) exec -c=${container} ${command} >> /var/log/cron.log 2>> /var/log/cron.log`;

                return job.toString();
            }).join(OS.EOL);
        }

        await FS.writeFile("./crontab.txt", crontab + OS.EOL);
        await exec("crontab ./crontab.txt");
        await FS.rm("./crontab.txt");
    }

    protected async getContainers() {
        const containers = await this.docker.listContainers();

        for(const container of containers) {
            console.log(container.Names);
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
