import "zx/globals";

import { Octokit } from "octokit";
import fs from "fs";

export const getCommits = async ({ repo, login }) => {
	if (repo.size == 0) return [];
	const git_dir = `./.cache/repos/${login}/${repo.name}.git`;

	await (fs.existsSync(git_dir) ? $`git --git-dir=${git_dir} fetch` : $`git clone --bare ${repo.clone_url} ${git_dir}`);

	// --numstat
	// git log --numstat --pretty=format:'%H%x09%an%x09%ae%x09%ct%x09%s' --all --no-merges > log.txt
	const log = await $`git --git-dir=${git_dir} log --pretty=format:'%an%x09%ae%x09%ci%x09%s%x09%H' --all --no-merges --numstat`;
	return log.stdout
		.trimEnd()
		.split("\n\n")
		.map((commitLog) => commitLog.split("\n"))
		.map(([commitLine, ...changesLogs]) => {
			const [name, mail, date, commit, hash] = commitLine.split("\t");
			const changes = changesLogs.map((change) => {
				const [add, del, file] = change.split("\t");
				return { add, del, file };
			});
			return { repo: repo.name, name, mail, date, commit, hash, changes };
		});
};

export const getGitStats = async ({ token, recentRepositoriesCount, login, runAsync }) => {
	const client = new Octokit({ auth: token });

	const q = {
		username: login,
		per_page: recentRepositoriesCount,
		sort: "created",
		direction: "desc",
	};

	const repos = (await client.rest.repos.listForUser(q)).data.filter((repo) => !repo.archived || !repo.fork);

	const commits = [];

	const pushCommits = async (repo) => {
		commits.push(...(await getCommits({ repo, login, client })));
	};

	if (runAsync) {
		await Promise.all(repos.map(pushCommits));
	} else {
		for (const repo of repos) await pushCommits(repo);
	}

	return commits;
};
