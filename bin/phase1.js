#!/usr/bin/env node
const snarkjs = require("snarkjs");
const ffjavascript = require("ffjavascript");
const yargs = require("yargs");
const fs = require("fs");

yargs.usage("$0 <cmd> [args]")
    .command("init-ptau [size]", "Generate power of tau file with `size`", (yargs) => {
        yargs.positional("size", {
            type: "number",
            default: 12,
            describe: "Size of ptau file"
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for ptau file generated",
            default: "./"
        })
    }, async function (argv) {
        if (!isNaN(argv.size)) {
            let size = argv.size;
            let curveBn128 = await ffjavascript.getCurveFromName("bn128", true);
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let fileName = "pot" + size + ".ptau";
            snarkjs.powersOfTau.newAccumulator(curveBn128, size, outputDir + fileName).then(async () => {
                // First contribution
                await snarkjs.powersOfTau.contribute(outputDir + fileName, outputDir + "temp_" + fileName, "First contribution");
                // Second contribution
                await snarkjs.powersOfTau.contribute(outputDir + "temp_" + fileName, outputDir + fileName, "Second contribution");
                let result = await snarkjs.powersOfTau.verify(outputDir + fileName);
                if (result == true) {
                    fs.unlinkSync(outputDir + "temp_" + fileName);
                    process.exit(0);
                } else {
                    console.log("Ptau file generated is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("require size");
        }
    }).command("export-challenge [ptau_path]", "Export challenge correspond to `ptau_path`", (yargs) => {
        yargs.positional("ptau_path", {
            type: "string",
            describe: "Path to ptau file",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "output directory for challenge file generated",
            required: true
        })
    }, async function (argv) {
        if (argv.ptau_path != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.ptau_path).split("/");
            temp = temp[temp.length - 1];
            let fileName = "challenge_" + temp.slice(0, temp.length - 5);
            snarkjs.powersOfTau.verify(argv.ptau_path).then(async (result) => {
                if (result) {
                    snarkjs.powersOfTau.exportChallenge(argv.ptau_path, outputDir + fileName).then(() => { process.exit(0); });
                } else {
                    console.log("Ptau file is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("Require ptau file");
        }
    }).command("contribute-challenge [challenge]", "Repond to challenge to create reponse file with entropy text", (yargs) => {
        yargs.positional("challenge", {
            type: "string",
            describe: "Path to challenge file",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "output directory for response file generated",
            required: true
        })
    }, async function (argv) {
        if (argv.challenge != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.challenge).split("/");
            temp = temp[temp.length - 1];
            let fileName = "response_" + temp;
            let curveBn128 = await ffjavascript.getCurveFromName("bn128", true);
            snarkjs.powersOfTau.challengeContribute(curveBn128, argv.challenge, outputDir + fileName).then(() => { process.exit(0); });
            console.log("Generating response will take few minutes . . .");
        } else {
            console.log("Require challenge file");
        }
    }).command("import-response [response]", "Generate ptau file correspond to response", (yargs) => {
        yargs.positional("response", {
            type: "string",
            describe: "Path to response file",
            required: true
        })
        yargs.option("ptau", {
            alias: "p",
            type: "string",
            description: "Input path for previous ptau file",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "output directory for ptau file generated",
            required: true
        })
    }, async function (argv) {
        if (argv.response != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.response).split("/");
            temp = temp[temp.length - 1];
            let fileName = temp + ".ptau"
            snarkjs.powersOfTau.verify(argv.ptau).then((result) => {
                if (result == true) {
                    snarkjs.powersOfTau.importResponse(argv.ptau, argv.response, outputDir + fileName, "Import response contribution", true).then(() => { process.exit(0); });
                    console.log("Generating ptau will take few minutes . . .");
                } else {
                    console.log("Previous ptau file is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("Require response file");
        }
    }).command("finalize [ptau_path]", "Generate final ptau file with applying random beacon", (yargs) => {
        yargs.positional("ptau_path", {
            type: "string",
            describe: "Path to previous ptau file",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "output directory for ptau file generated",
            required: true
        })
    }, async function (argv) {
        if (argv.ptau_path != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.ptau_path).split("/");
            temp = temp[temp.length - 1];
            let fileName = temp
            snarkjs.powersOfTau.verify(argv.ptau_path).then(async (result) => {
                if (result) {
                    console.log("Generating ptau will take few minutes . . .");
                    await snarkjs.powersOfTau.beacon(argv.ptau_path, outputDir + "beacon_" + fileName, "Applying beacon contribution", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", 10);
                    await snarkjs.powersOfTau.preparePhase2(outputDir + "beacon_" + fileName, outputDir + "final_" + fileName);
                    fs.unlinkSync(outputDir + "beacon_" + fileName);
                    process.exit(0);
                } else {
                    console.log("Ptau file is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("Require ptau_path file");
        }
    })
    .help()
    .argv