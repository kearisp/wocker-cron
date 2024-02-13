import {promises} from "fs";
import * as Path from "path";


type ReaddirOptions = {
    recursive?: boolean;
    _parent?: string;
};

export class FS {
    public static async readdir(path: string, options?: ReaddirOptions): Promise<string[]> {
        const {
            recursive = false,
            _parent = ""
        } = options || {};

        if(recursive) {
            const files = await promises.readdir(path, {
                withFileTypes: true
            });

            const paths: string[] = [];

            for(const file of files) {
                const filePath = Path.join(_parent, file.name);

                if(file.isDirectory()) {
                    paths.push(...await FS.readdir(`${path}/${file.name}`, {
                        recursive: true,
                        _parent: filePath
                    }));
                }
                else {
                    paths.push(filePath);
                }
            }

            return Promise.all(paths);
        }

        return promises.readdir(path);
    }
}
