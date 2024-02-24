import * as Path from "path";
import {watch} from "fs";

import {FS} from "./FS";
import {spawn} from "../utils/spawn";


class Watcher {
    protected abortController?: AbortController;

    public constructor(
        protected path: string
    ) {}

    public async start() {
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

    public async watch() {
        const files = await FS.readdir(this.path, {
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
