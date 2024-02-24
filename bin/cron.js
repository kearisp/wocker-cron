#!/usr/bin/env node


const {App} = require("./../lib/index");

const app = new App();
app.run(process.argv);
