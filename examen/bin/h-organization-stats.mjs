#!/usr/bin/env node

import args from "args";
import { getGitStats } from "../src/index.js";
import fs from "fs";

// TODO: args validation
const year = 365 * 24 * 60 * 60 * 1000;
args
	.option("login", "Github login")
	.option("runAsync", "Run Git asynchronously", true)
	.option("verbose", "Verbose mode", false)
	.option("recentRepositoriesCount", "Number of recent repositories to fetch", 100)
	.option("token", "Github token", undefined)
	.option("out", "Output file")
	.option("fromDate", "From date", new Date(Date.now() - 4 * year).toISOString());

const { login, runAsync, verbose, recentRepositoriesCount, token, out, fromDate } = args.parse(process.argv);

if (!login || typeof login !== "string") {
	console.error("Login is required");
	process.exit(1);
}

$.verbose = verbose;

const outputFile = out || `./data/${login}.json`;

const stats = await getGitStats({ token, recentRepositoriesCount, login, runAsync });

const filteredStats = stats.filter((s) => !s.name.match(/\[bot\]$/) && fromDate < s.date);
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

fs.writeFileSync(outputFile, JSON.stringify(filteredStats));
console.info(`Stats saved to ${outputFile}`);
