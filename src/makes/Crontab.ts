import * as OS from "os";

import {Job} from "./Job";


export class Crontab {
    public constructor(
        public jobs: Job[]
    ) {}

    public push(...jobs: Job[]) {
        this.jobs.push(...jobs);

        return this;
    }

    public filter(predicate: ((job: Job) => boolean)) {
        this.jobs = this.jobs.filter(predicate);

        return this;
    }

    public toString() {
        return this.jobs.map((job) => {
            return job.toString()
        }).join(OS.EOL) + OS.EOL;
    }

    public static fromString(crontab: string) {
        const jobs = crontab.split(/\r?\n/).filter((job) => {
            return !!job;
        }).map((job) => {
            return Job.fromString(job);
        });

        return new Crontab(jobs);
    }
}