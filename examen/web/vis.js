/**
 * @typedef {typeof import("d3")} window.d3
 *
 * @typedef {{
 * 	add: string;
 * 	del: string;
 * 	file: string;
 * }} Change
 *
 * @typedef {{
 * 	repo: string;
 * 	name: string;
 * 	mail: string;
 * 	date: string;
 * 	commit: string;
 * 	hash: string;
 * 	changes: Change[];
 * }} Commit
 */

const languagesByExtension = {
	js: { name: "JavaScript", color: "#d9c316" },
	ts: { name: "TypeScript", color: "#2b7489" },
	py: { name: "Python", color: "#3572A5" },
	rb: { name: "Ruby", color: "#701516" },
	css: { name: "CSS", color: "#563d7c" },
	html: { name: "HTML", color: "#e34c26" },
	md: { name: "Markdown", color: "#083fa1" },
	sh: { name: "Shell", color: "#89e051" },
	svelte: { name: "Svelte", color: "#ff3e00" },
	tex: { name: "TeX", color: "#3D6117" },
	ipynb: { name: "Jupyter Notebook", color: "#DA5B0B" },
};

const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n);

/** @param {Change[]} changes */
function getLangAndChangesCount(changes) {
	// Count changes per extension
	const changesPerFileExtension = changes.reduce((acc, change) => {
		const ext = change.file.match(/\.([^.]+)$/)?.[1] ?? undefined;
		if (!ext || !(ext in languagesByExtension)) return acc;
		if (!isNumeric(change.add) || !isNumeric(change.del)) return acc;
		const count = parseInt(change.add) + parseInt(change.del);
		return { ...acc, [ext]: (acc[ext] || 0) + count };
	}, {});
	// Get lang with more changes
	const [lang] = Object.entries(changesPerFileExtension).reduce((acc, cur) => (cur[1] > acc[1] ? cur : acc), [undefined, -1]);
	// Get total changes
	const count = Object.values(changesPerFileExtension).reduce((acc, cur) => acc + cur, 0);
	return [lang, count];
}

/** @param {Commit[]} commits */
function groupByRepoAndLang(commits) {
	/* Group by repo and lang */
	const repos = commits.reduce((acc, { repo, commit, changes, hash, name }) => {
		if (!(repo in acc)) acc[repo] = [];

		const [lang, count] = getLangAndChangesCount(changes);
		if (!lang) return acc;

		acc[repo].push({ commit, hash, count, lang, repo, changes, name });
		return acc;
	}, {});

	/* Convert to tree data */
	const treeData = Object.entries(repos).map(([repo, commits]) => ({
		name: repo,
		children: commits,
	}));
	return treeData;
}

/** @param {d3.Selection} element */
function renderEmptyCommitInfo(element) {
	element.selectAll("*").remove();
	element.append("div").attr("class", "waiting-selection").text("Has hover sobre un commit para ver más información");
}

window.state = {};
window.onload = function () {
	const width = 960;
	const height = 500;

	d3.selectAll(".org-commits-vis").each(async function () {
		const container = d3.select(this);
		const login = container.attr("data-login");

		if (!login) return;

		/** @type {Commit[]} */
		const allData = await d3.json(`./data/${login}.json`);

		const monthsArray = [
			...new Set(new Array(36).fill(0).map((_, i) => new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7))),
		];

		const filteredData = allData.filter((d) => monthsArray.includes(d.date.slice(0, 7)));

		/**
		 * @typedef {{
		 * 	selectedRepo?: string;
		 * 	fromMonth?: string;
		 * 	toMonth?: string;
		 * }} State
		 * @param {(oldState: State) => State} fn
		 */
		function update(fn) {
			window.state = fn ? fn(window.state) ?? {} : {};
			console.log("update with state", window.state);
			const { selectedRepo, fromMonth, toMonth } = window.state;
			let data = selectedRepo ? allData.filter((d) => d.repo === selectedRepo) : filteredData;
			data = fromMonth ? data.filter((d) => d.date >= fromMonth) : data;
			data = toMonth ? data.filter((d) => d.date <= toMonth) : data;
			data = data.filter((d) => d.name !== "dependabot[bot]");
			// Run in next tick
			setTimeout(() => render(data), 0);
		}

		container
			.append("g")
			.attr("class", "org-commits-vis-controls")
			.call((g) =>
				g
					.append("button")
					.text("Clear")
					.on("click", () => {
						window.state = {};
						brushG.call(monthBrush.move, null);
					})
			);

		const treeSvg = container.append("svg").attr("viewBox", [0, 0, width, height]).attr("class", "org-commits-vis-tree");
		const contributorsSvg = container.append("svg").attr("viewBox", [0, 0, width, height]).attr("class", "org-commits-vis-contributors");
		const commitsView = container.append("div").attr("class", "org-commits-vis-commit");
		const visInfo = container.append("div").attr("class", "org-commits-vis-info");
		const commitInfo = commitsView.append("div").attr("class", "commit-info").call(renderEmptyCommitInfo);

		const commitTip = commitsView
			.append("div")
			.attr("class", "commit-tip")
			.style("opacity", 0)
			.html(`Has click con <kbd>${window.navigator.platform === "MacIntel" ? "⌘" : "Ctrl"}</kbd> para ver el commit en GitHub.`);

		commitsView.display = (element) => {
			element.on("mouseover", (e, { data }) => {
				commitInfo.selectAll("*").remove();
				commitInfo.append("h3").text(data.commit);
				commitInfo.append("p").text(data.repo);
				commitInfo.append("p").text(`${data.name} (${languagesByExtension[data.lang].name})`);
				commitInfo
					.append("ul")
					.attr("class", "changes-list")
					.selectAll("li")
					.data(data.changes.slice(0, 5))
					.join("li")
					.attr("class", "commit-info-change")
					.text((d) => `${d.file} [${d.add} | ${d.del}]`);
				commitTip.style("opacity", 1);
			});
			element.on("mouseout", () => {
				commitInfo.call(renderEmptyCommitInfo);
				commitTip.style("opacity", 0);
			});
		};

		const marginTop = 50;
		const contributorsHeight = height - marginTop;

		const contributorToShow = 15;

		const commitsGroupWidth = width - 150;
		const monthBrush = d3.brushX().extent([
			[0, 0],
			[commitsGroupWidth, contributorsHeight],
		]);
		const xScale = d3.scaleBand().range([commitsGroupWidth, 0]).domain(monthsArray).paddingInner(0.1).round(true);
		const yScale = d3.scaleBand().range([marginTop, height]).domain(d3.range(0, contributorToShow)).paddingInner(0.4).round(true);

		const xAxisGenerator = d3.axisTop(xScale).tickSizeOuter(0);
		const xAxis = contributorsSvg.append("g").attr("class", "xAxis").attr("transform", `translate(0, ${marginTop})`).call(xAxisGenerator);
		xAxis.selectAll(".tick text").attr("transform", `rotate(-45) translate(20,0)`);

		const brushG = contributorsSvg
			.append("g")
			.attr("class", "month-brush")
			.attr("transform", `translate(0, ${marginTop})`)
			.call(monthBrush);

		monthBrush.on("brush", ({ selection }) => {
			if (!selection) return;
			const [start, end] = selection;
			const startPadding = xScale.step();

			contributorsSvg.selectAll("rect.contributor-commits-date").attr("stroke", ({ month }) => {
				const x = xScale(month);
				if (start - startPadding < x && x < end) return "red";
			});
		});

		monthBrush.on("end", ({ selection }) => {
			contributorsSvg.selectAll("rect.contributor-commits-date").attr("stroke", null);
			if (!selection) return update(({ fromMonth, toMonth, ...s }) => s);
			const [fromX, toX] = selection;
			const xDomain = xScale.domain().reverse();
			const xStep = xScale.step();
			const fromMonth = xDomain[Math.trunc(fromX / xStep)];
			const toMonth = xDomain[Math.trunc(toX / xStep)];
			update((s) => ({ ...s, fromMonth, toMonth }));
		});

		/** @param {d3.Selection} selection */
		function setTreePosition(selection) {
			selection
				.attr("x", (d) => d.x0)
				.attr("y", (d) => d.y0)
				.attr("width", (d) => d.x1 - d.x0)
				.attr("height", (d) => d.y1 - d.y0);
		}

		treeSvg.on("click", (e, d) => {
			if (!window.state.selectedRepo) return;
			update(({ selectedRepo, ...s }) => s);
			e.stopPropagation();
		});

		visInfo
			.call((div) => div.append("h3").text("Información"))
			.call((div) =>
				div
					.append("p")
					.text(
						`Cada rectángulo representa un commit, su color es el lenguaje, el tamaño es proporcional al cuadrado de la cantidad de cambios. Puedes hacer hover en un commit para ver más información, y hacer click para ver un repositorio en particular. También puedes filtrar pro fechas, utilizando brush en la visualización de contribuidores da abajo.`
					)
			)
			.call((div) => div.append("h4").text("Lenguajes de los commits"))
			.call((div) =>
				div
					.append("ul")
					.selectAll("li")
					.data([...Object.values(languagesByExtension)])
					.enter()
					.append("li")
					.attr("class", "vis-info-lang-color")
					.style("background-color", (d) => d.color)
					.text((d) => d.name)
			)
			.call((div) => div.append("h4").text("Escala de commits por contribuidor"));
		const colorScaleContainer = visInfo
			.append("svg")
			.attr("viewBox", [0, 0, 100, 100])
			.attr("width", 100)
			.attr("class", "color-scale-container");

		/** @param {Commit[]} data */
		function render(data) {
			// Tree
			const children = groupByRepoAndLang(data);
			const scale = d3.scaleSqrt();
			const hierarchy = d3.hierarchy({ name: "repos", children }).sum((d) => scale(d.count));
			const treeMap = d3.treemap().tile(d3.treemapBinary).size([width, height]).padding(1).paddingTop(13).round(true);
			const root = treeMap(hierarchy).sort((a, b) => b.height - a.height || b.value - a.value);

			treeSvg
				.selectAll("g.repo")
				.data(root?.children ?? [], (d) => d.data.name)
				.join(
					(enter) =>
						enter
							.append("g")
							.attr("class", "repo")
							.attr("data-repo", (d) => d.data.name)
							.call((g) => g.append("rect").attr("class", "background").attr("fill", "#eee").call(setTreePosition))
							.call((g) =>
								g
									.append("text")
									.attr("class", "repo-name")
									.attr("x", (d) => d.x0 + 3)
									.attr("y", (d) => d.y0 + 9)
									.attr("fill", "#333")
									.attr("font-size", 10)
									.text((d) => d.data.name)
									.style("clip-path", (d) => `polygon(0 0, ${d.x1 - d.x0}px 0, ${d.x1 - d.x0}px ${d.y1 - d.y0}px, 0 ${d.y1 - d.y0}px)`)
							)
							.on("click", (e, d) => {
								update((s) => ({ ...s, selectedRepo: d.data.name }));
								e.stopPropagation();
							}),
					(update) =>
						update
							.call((g) => g.select("rect.background").call(setTreePosition))
							.call((g) =>
								g
									.select("text.repo-name")
									.transition()
									.attr("x", (d) => d.x0 + 3)
									.attr("y", (d) => d.y0 + 9)
									.style("clip-path", (d) => `polygon(0 0, ${d.x1 - d.x0}px 0, ${d.x1 - d.x0}px ${d.y1 - d.y0}px, 0 ${d.y1 - d.y0}px)`)
							),
					(exit) => exit.remove()
				)
				.selectAll("g.commits")
				.data((d) => [d])
				.join(
					(enter) => enter.append("g").attr("class", "commits"),
					(update) => update,
					(exit) => exit.remove()
				)
				.selectAll("rect.commit")
				.data(
					(d) => d?.children ?? [],
					(d) => d.data.hash
				)
				.join(
					(enter) =>
						enter
							.append("rect")
							.attr("class", "commit")
							.call(setTreePosition)
							.attr("fill", (d) => languagesByExtension[d.data.lang].color)
							.on("click", (e, { data: d }) => {
								const isCommandClick = e.metaKey || e.ctrlKey;
								if (isCommandClick) {
									e.stopPropagation();
									const url = `https://github.com/${login}/${d.repo}/commit/${d.hash}`;
									window.open(url, "_blank");
								}
							})
							.call(commitsView.display),
					(update) => update.transition().call(setTreePosition),

					(exit) => exit.remove()
				);

			const contributors = d3
				.rollups(
					data,
					(v) => v.length,
					(d) => d.name,
					(d) => d.date.slice(0, 7)
				)
				.map(([name, oldMonthsObj]) => ({ name, months: oldMonthsObj.map(([month, count]) => ({ month, count })) }))
				.filter((d) => d.months.length > 0)
				.sort((a, b) => b.months.reduce((total, { count }) => total + count, 0) - a.months.reduce((total, { count }) => total + count, 0))
				.slice(0, 15);

			const maxCommits = d3.max(contributors, (d) => d3.max(d.months, (d) => d.count));
			const colorScale = d3.scaleSequentialSqrt(d3.interpolateBlues).domain([0, maxCommits]);

			contributorsSvg
				.selectAll("g.contributor")
				.data(contributors, (d) => d.name)
				.join(
					(enter) =>
						enter
							.append("g")
							.attr("class", "contributor")
							.attr("data-contributor", (d) => d.name)
							.attr("transform", (d, i) => `translate(0, ${yScale(i)})`)
							.call((g) => {
								g.append("text")
									.attr("class", "contributor-name")
									.attr("x", commitsGroupWidth + 2)
									.attr("y", yScale.bandwidth() / 2)
									.attr("domaint-baseline", "central")
									.attr("dy", "0.35em")
									.text((d) => d.name);
							})
							.on("mouseenter", (e, { name }) =>
								d3
									.selectAll(`rect.commit`)
									.attr("fill-opacity", 1)
									.transition()
									.attr("fill-opacity", (d) => (d.data.name === name ? 1 : 0.2))
							)
							.on("mouseleave", () =>
								d3.selectAll(`rect.commit`).transition().attr("fill-opacity", 1).transition().duration(0).attr("fill-opacity", null)
							)
							.style("opacity", 0)
							.transition()
							.style("opacity", 1),
					(update) =>
						update
							.style("opacity", 1)
							.transition()
							.attr("transform", (d, i) => `translate(0, ${yScale(i)})`),
					(exit) => exit.transition().style("opacity", 0).remove()
				)
				.selectAll("g.contributor-commits")
				.data((d) => [d])
				.join(
					(enter) => enter.append("g").attr("class", "contributor-commits"),
					(update) => update,
					(exit) => exit.remove()
				)
				.selectAll("rect.contributor-commits-date")
				.data(
					(d) => d.months,
					(d) => d.month
				)
				.join(
					(enter) =>
						enter
							.append("rect")
							.attr("class", "contributor-commits-date")
							.attr("data-month", (d) => d.month)
							.attr("x", (d) => xScale(d.month))
							.attr("y", 0)
							.attr("width", xScale.bandwidth())
							.attr("height", yScale.bandwidth())
							.attr("fill", (d) => colorScale(d.count)),
					(update) => update.transition().attr("fill", (d) => colorScale(d.count)),
					(exit) => exit.remove()
				);

			// Info
			// const colorLegend = d3.legendColor().scale(colorScale);
			// get domain of color scale

			const scaleElements = new Array(5).fill(0).map((_, i) => {
				const value = Math.round((i / 4) * maxCommits);
				return { value: Math.round(value), color: colorScale(value) };
			});

			console.log(scaleElements);

			colorScaleContainer
				.selectAll(".color-scale")
				.data(scaleElements, (d, i) => i)
				.join(
					(enter) =>
						enter
							.append("g")
							.attr("class", "color-scale")
							.attr("transform", (d, i) => `translate(0, ${i * 20})`)
							.call((g) =>
								g
									.append("rect")
									.attr("width", 20)
									.attr("height", 20)
									.attr("fill", (d) => d.color)
							)
							.call((g) =>
								g
									.append("text")
									.attr("x", 25)
									.attr("domaint-baseline", "central")
									.attr("dy", "0.35em")
									.attr("y", 10)
									.text((d) => d.value)
							),
					(update) => update.call((g) => g.select("rect").attr("fill", (d) => d.color)).call((g) => g.select("text").text((d) => d.value))
				);

			brushG.raise();
		}

		update();
	});
};
