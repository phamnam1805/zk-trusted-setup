#!/usr/bin/env node
const snarkjs = require("snarkjs");
const ffjavascript = require("ffjavascript");
const yargs = require("yargs");
const fs = require("fs");

yargs.usage("$0 <cmd> [args]")
    .command("setup-zkey [r1cs]", "Init zkey file correspond to r1cs and ptau file", (yargs) => {
        yargs.positional("r1cs", {
            type: "string",
            describe: "Path to r1cs file",
            required: true
        })
        yargs.option("ptau", {
            alias: "p",
            type: "string",
            description: "Ptau file for generating zkey",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for zkey file generated",
            default: "./",
            required: true
        })
    }, async function (argv) {
        if (argv.r1cs != undefined || argv.r1cs.endsWith(".r1cs")) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.r1cs).split("/");
            temp = temp[temp.length - 1];
            let fileName = temp.slice(0, temp.length - 5) + ".zkey";
            snarkjs.powersOfTau.verify(argv.ptau).then(async (result) => {
                if (result) {
                    await snarkjs.zKey.newZKey(argv.r1cs, argv.ptau, outputDir + fileName);
                    // First contribution 
                    await snarkjs.zKey.contribute(outputDir + fileName, outputDir + "temp_" + fileName, "First contribution");
                    // Second contribution
                    await snarkjs.zKey.contribute(outputDir + "temp_" + fileName, outputDir + fileName, "Second contribution");
                    let result1 = await snarkjs.zKey.verifyFromR1cs(argv.r1cs, argv.ptau, outputDir + fileName);
                    if (result1) {
                        fs.unlinkSync(outputDir + "temp_" + fileName);
                        process.exit(0);
                    } else {
                        console.log("Zkey file is not valid");
                        process.exit(0);
                    }
                } else {
                    console.log("Ptau file is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("Require r1cs file");
        }
    }).command("export-challenge [zkey_path]", "Export challenge correspond to `zkey_path`", (yargs) => {
        yargs.positional("zkey_path", {
            type: "string",
            required: true,
            describe: "Path to zkey file"
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for challenge file generated",
            default: "./",
            required: true
        })
    }, async function (argv) {
        if (argv.zkey_path != undefined || argv.r1cs.endsWith(".zkey")) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.zkey_path).split("/");
            temp = temp[temp.length - 1];
            let fileName = "challenge_" + temp.slice(0, temp.length - 5);
            snarkjs.zKey.exportBellman(argv.zkey_path, outputDir + fileName).then(() => { process.exit(0) });
        } else {
            console.log("Require zkey file");
        }
    })
    .command("contribute-challenge [challenge]", "Repond to challenge to create reponse file with entropy text", (yargs) => {
        yargs.positional("challenge", {
            type: "string",
            required: true,
            describe: "Path to challenge file"
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for reponse file generated",
            default: "./",
            required: true
        })
    }, async function (argv) {
        if (argv.challenge != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.challenge).split("/");
            temp = temp[temp.length - 1];
            let fileName = "response_" + temp;
            let curveBn128 = await ffjavascript.getCurveFromName("bn128", true);
            snarkjs.zKey.bellmanContribute(curveBn128, argv.challenge, outputDir + fileName).then(() => { process.exit(0) });
        } else {
            console.log("Require challenge file");
        }
    }).command("import-response [response]", "Generate zkey file correspond to response", (yargs) => {
        yargs.positional("response", {
            type: "string",
            required: true,
            describe: "Path to response file"
        })
        yargs.option("zkey", {
            alias: "z",
            type: "string",
            description: "Input path for previous zkey file",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for zkey file generated",
            default: "./",
            required: true
        })
    }, async function (argv) {
        if (argv.response != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.response).split("/");
            temp = temp[temp.length - 1];
            let fileName = temp + ".zkey";
            snarkjs.zKey.importBellman(argv.zkey, argv.response, outputDir + fileName, "Import response contribution").then(() => { process.exit(0) });
        } else {
            console.log("Require response file");
        }
    }).command("finalize [zkey_path]", "Generate final zkey file with applying random beacon", (yargs) => {
        yargs.positional("zkey_path", {
            type: "string",
            required: true,
            describe: "Path to previous zkey file"
        })
        yargs.option("r1cs", {
            alias: "r",
            type: "string",
            description: "Input path for r1cs file",
            required: true
        })
        yargs.option("ptau", {
            alias: "p",
            type: "string",
            description: "Input path for ptau file used to generate zkey",
            required: true
        })
        yargs.option("output", {
            alias: "o",
            type: "string",
            description: "Output directory for zkey file generated",
            default: "./",
            required: true
        })
    }, async function (argv) {
        if (argv.zkey_path != undefined) {
            let outputDir = argv.output.endsWith("/") ? argv.output : argv.output += "/";
            let temp = String(argv.zkey_path).split("/");
            temp = temp[temp.length - 1];
            let fileName = "final_" + ".zkey";
            snarkjs.zKey.verifyFromR1cs(argv.r1cs, argv.ptau, argv.zkey_path).then(async (result) => {
                if (result) {
                    await snarkjs.zKey.beacon(argv.zkey_path, outputDir + fileName, "Applying beacon contribution", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", 10);
                    let result1 = await snarkjs.zKey.verifyFromR1cs(argv.r1cs, argv.ptau, outputDir + fileName);
                    if (result1) {
                        let verificationKey = await snarkjs.zKey.exportVerificationKey(outputDir + fileName);
                        let verificationKeyString = JSON.stringify(verificationKey);
                        fs.writeFile(outputDir + "verification_key.json", verificationKeyString, (err) => {
                            if (err) {
                                throw err;
                            }
                            console.log("JSON data is saved.");
                        });
                        let templates = {
                            groth16: fs.readFileSync(__dirname + "/../contract_templates/verifier_groth16.sol.ejs", "utf-8"),
                            plonk: fs.readFileSync(__dirname + "/../contract_templates/verifier_groth16.sol.ejs", "utf-8")
                        };
                        let verifierContract = await snarkjs.zKey.exportSolidityVerifier(outputDir + fileName, templates);
                        fs.writeFileSync(outputDir + "Verifier.sol", verifierContract.toString());
                        console.log("Generated zkey!");
                        process.exit(0);
                    } else {
                        console.log("Zkey file is not valid");
                        process.exit(0);
                    }
                } else {
                    console.log("Zkey file is not valid");
                    process.exit(0);
                }
            });
        } else {
            console.log("Require zkey file");
        }
    })
    .help()
    .argv