import {exec as processExec} from "child_process";


const exec = async (command: string) => {
    return new Promise((resolve, reject) => {
        const worker = processExec(command, {
            maxBuffer: Infinity
        }, (err, stdout, stderr) => {
            if(err) {
                return reject(err);
            }

            return resolve({
                stdout,
                stderr
            });
        });

        if(worker.stdout) {
            worker.stdout.on("data", (data) => {
                process.stdout.write(data);
            });
        }

        if(worker.stderr) {
            worker.stderr.on("data", (data) => {
                process.stderr.write(data);
            });
        }

        worker.on("close", (code: string) => {
            // Logger.info("close", chalk.red(code));
        });

        worker.on("exit", (code: string) => {
            // Logger.info("exit", chalk.red(code));
        });
    });
};


export {exec};