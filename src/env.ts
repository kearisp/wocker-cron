import * as OS from "os";
import * as Path from "path";


export const DATA_DIR = process.env.WS_DIR || Path.join(OS.homedir(), ".workspace");
export const PLUGINS_DIR = Path.join(DATA_DIR, "plugins");
export const CONFIG_PATH = Path.join(PLUGINS_DIR, "cron", "crontab.json");
export const LOG_PATH = Path.join(DATA_DIR, "ws.log");
export const EDITOR = process.env.EDITOR;
