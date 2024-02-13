import {exec as processExec} from "child_process";


export const exec = async (command: string): Promise<string> => {
    const worker = processExec(command, {
        maxBuffer: Infinity
    });

    return new Promise((resolve, reject) => {
        let data = "";

        worker.stdout.on("data", (chunk) => {
            data += chunk.toString();
        });

        worker.on("exit", (code) => {
            if(code !== 0) {
                reject(new Error(`Process exited with code ${code}`));

                return;
            }

            resolve(data);
        });

        worker.on("error", (err) => {
            reject(err);
        });
    });
};
