import * as OS from "os";
import * as Path from "path";


export const DATA_DIR = process.env.WS_DIR || Path.join(OS.homedir(), ".workspace");
export const CONFIG_PATH = Path.join(DATA_DIR, "crontab.json");
