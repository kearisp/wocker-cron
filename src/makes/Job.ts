export class Job {
    public constructor(
        public min = "*",
        public hour = "*",
        public dayOfMonth = "*",
        public month = "*",
        public dayOfWeek = "*",
        public command = "echo 'No command'"
    ) {}

    public toString() {
        return `${this.min} ${this.hour} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek} ${this.command}`;
    }

    public static fromString(job: string) {
        const [,
            min,
            hour,
            dayOfMonth,
            month,
            dayOfWeek,
            command
        ] = /(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/.exec(job) || [];

        return new Job(min, hour, dayOfMonth, month, dayOfWeek, command);
    }
}