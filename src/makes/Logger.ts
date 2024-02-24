import * as fs from "fs";

import {LOG_PATH} from "../env";


const prepareNumber = (n: number) => {
    return `${n < 10 ? "0" : ""}${n}`;
};

export class Logger {
    protected static _log(type: string, container: any, ...args: any[]): void {
        const date = new Date();
        const time = `${date.getFullYear()}-${prepareNumber(date.getMonth() + 1)}-${prepareNumber(date.getDate())} ${prepareNumber(date.getHours())}:${prepareNumber(date.getMinutes())}:${prepareNumber(date.getSeconds())}`;

        const logData = args.map((arg) => {
            return typeof arg !== "string" ? JSON.stringify(arg) : arg;
        }).join(" ");

        if(!fs.existsSync(LOG_PATH)) {
            fs.writeFileSync(LOG_PATH, "");
        }

        fs.appendFileSync(LOG_PATH, `[${time}][${container}] ${type}: ${logData}\n`);
    }

    public static log(container: string, ...args: any[]): void {
        Logger._log("log", container, ...args);
    }
}
