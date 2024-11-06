import {FileSystem} from "@wocker/core";
import * as Path from "path";
import {watch} from "fs";

import {spawn} from "../utils/spawn";


class Watcher {
    protected abortController?: AbortController;

    public constructor(
        protected path: string
    ) {}

    public async start(): Promise<void> {
        if(this.abortController) {
            this.abortController.abort();
        }

        this.abortController = new AbortController();

        try {
            console.log("Starting...");
            await spawn("ws-cron", ["process"], {
                signal: this.abortController.signal
            });
        }
        catch(err) {
            console.log("Stopping...");
        }
    }

    public async watch(): Promise<void> {
        const fs = new FileSystem(this.path);
        const files = await fs.readdirFiles("", {
            recursive: true
        });

        let timeout: NodeJS.Timeout;

        const start = () => {
            if(timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => {
                this.start();
            }, 500);
        };

        for(const path of files) {
            const fullPath = Path.join(this.path, path);

            if(Path.extname(path) !== ".js") {
                continue;
            }

            watch(fullPath, (event, filename) => {
                start();
            });
        }

        start();
    }
}


export {Watcher};
