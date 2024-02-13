import {spawn as processSpawn, SpawnOptions} from "child_process";


type Options = Omit<SpawnOptions, "stdio">;

export const spawn = async (command: string, args: string[], options?: Options) => {
    const child = processSpawn(command, args, {
        stdio: "inherit",
        ...options || {}
    });

    await new Promise((resolve, reject) => {
        let withError: boolean = false;

        child.on("close", (code) => {
            if(withError) {
                return;
            }

            if(code !== 0) {
                reject(new Error(`Process exited with code ${code}`));

                return;
            }

            resolve(undefined);
        });

        child.on("error", (err) => {
            withError = true;
            reject(err);
        });
    });
};
