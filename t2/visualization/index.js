// Install type annotations with the @types/d3 package
// “Typescript” in plain JS 👀
/**
 * @typedef {{ [category: string]: number }} Categories Número de obras por categoría
 * @typedef {{
 * 	Artist: string,
 * 	Nacionality: string,
 * 	Gender: string,
 * 	BirthYear: number,
 * 	DeathYear: number,
 *  TotalArtwork: number,
 *  Categories: Categories,
 *  Age: number,
 * }} Artist
 * @typedef {{
 *  Category: string,
 * 	Artist: string,
 * 	Artwork: number,
 *  Male: number,
 *  Female: number,
 * }} Category
 */

/** @type {Promise<Artist[]>} */
const getArtistsData = (async () => {
	/** @type {Record<keyof Omit<Artist, "Age">, string>[]} */
	const allArtistsRaw = await d3.csv("../data/ArtistProcessed.csv");
	const currentYear = new Date().getFullYear();
	return allArtistsRaw.map((artist) => ({
		...artist,
		BirthYear: +artist.BirthYear,
		DeathYear: +artist.DeathYear,
		Age: (+artist.DeathYear === -1 ? currentYear : +artist.DeathYear) - +artist.BirthYear,
		TotalArtwork: +artist.TotalArtwork,
		Categories: JSON.parse(artist.Categories),
	}));
})();

/** @type {Promise<Category[]>} */
const getCategoriesData = (async () => {
	/** @type {Record<keyof Category, string>[]} */
	const categoriesRaw = await d3.csv("../data/CategoryProcessed.csv");
	return categoriesRaw.map((category) => ({
		...category,
		Artist: +category.Artist,
		Artwork: +category.Artwork,
		Female: +category.Female,
		Male: +category.Male,
	}));
})();

const formatAsPercentage = new Intl.NumberFormat(undefined, {
	style: "percent",
	minimumFractionDigits: 2,
}).format;

/** @type {{ currentCategory: null | string }} */
const state = { currentCategory: null };
function setCategory(category) {
	state.currentCategory = category;
	buildArtistsVisualization();
}

onload = () => {
	buildCategoriesVisualization();
	buildArtistsVisualization();

	const onlyAliveElement = d3.select("#only-alive");
	const orderSelectElement = d3.select("#order-select");
	const filterContainerElement = d3.select("#filters-container");
	const resetElement = d3.select("#reset-filters-element");

	// Listen to window resize event
	d3.select(window).on("resize", () => {
		const { width } = d3.select("#flowers > svg").node().getBoundingClientRect();
		const columns = Math.floor(width / 100);
		if (columns !== amountOfCols) {
			amountOfCols = columns;
			buildArtistsVisualization();
		}
	});

	resetElement.on("click", () => {
		resetElement.property("disabled", true);
		filterContainerElement.classed("active", false);
		onlyAliveElement.property("checked", false);
		orderSelectElement.property("value", "random");
		onlyAlive = false;
		order = "random";
		buildArtistsVisualization();
	});

	onlyAliveElement.on("change", () => {
		resetElement.property("disabled", false);
		filterContainerElement.classed("active", true);
		onlyAlive = true;
		buildArtistsVisualization();
	});

	orderSelectElement.on("change", () => {
		resetElement.property("disabled", false);
		filterContainerElement.classed("active", true);
		order = orderSelectElement.property("value");
		buildArtistsVisualization();
	});
};

/** @type {Boolean | undefined} */
let onlyAlive;
/** @type {"random" | "original" | ""} */
let order = "random";
/** @type {number} */
let amountOfCols = 10;

async function buildCategoriesVisualization() {
	const categories = await getCategoriesData;
	const borderWidthScale = d3
		.scaleLinear()
		.domain([0, Math.max(...categories.map((c) => c.Artist))])
		.range([`0px`, `15px`]);

	const frames = d3.select("#frames").selectAll("div").data(categories).enter().append("div");

	frames
		.append("p")
		.attr("class", "category-name")
		.text((d) => d.Category);

	const frameContent = frames
		.append("div")
		.attr("class", "frame-border")
		.style("--color", (_, i) => d3.schemeTableau10[i])
		.style("--size", (d) => borderWidthScale(d.Artist))
		.append("div")
		.attr("class", "frame")
		.on("click", (e, d) => setCategory(d.Category));

	const genderContainer = frameContent.append("div").attr("class", "gender");

	genderContainer
		.append("div")
		.attr("class", "gender-percentage female-percentage")
		.text((d) => formatAsPercentage(d.Female / d.Artist));

	genderContainer
		.append("div")
		.attr("class", "gender-percentage male-percentage")
		.text((d) => formatAsPercentage(d.Male / d.Artist));

	genderContainer
		.append("div")
		.attr("class", "gender female")
		.style("height", (d) => `${(100 * d.Female) / d.Artist}%`);

	genderContainer
		.append("div")
		.attr("class", "gender male")
		.style("height", (d) => `${(100 * d.Male) / d.Artist}%`);
}
/** @argument {Artist[]} artists */
function sortedArtists(artists) {
	switch (order) {
		case "random":
			return d3.shuffle(artists);
		case "original":
			return artists;
		case "age":
			return artists.sort((a, b) => a.Age - b.Age);
		case "name":
			return artists.sort((a, b) => a.Artist.localeCompare(b.Artist));
		case "amount":
			return artists.sort((a, b) => b.TotalArtwork - a.TotalArtwork);
	}
}

/** @argument {Artist[]} allArtists */
function makeArtistsList(allArtists) {
	let filteredArtists = onlyAlive ? allArtists.filter((a) => a.DeathYear === -1) : allArtists;
	return sortedArtists(filteredArtists).slice(0, 100);
}

async function buildArtistsVisualization() {
	// Data

	const artists = await getArtistsData;
	const categories = await getCategoriesData;

	const { currentCategory: category } = state;

	const maxArtistAge = Math.max(...artists.map((a) => a.Age));
	const stemScale = d3.scaleLinear().domain([0, maxArtistAge]).range([0, 100]);

	const filteredArtistsByCategory = category
		? artists.filter((a) => a.Categories[category] > 0)
		: artists;
	const limitedArtists = makeArtistsList(filteredArtistsByCategory);

	const maxCategoryValue = Math.max(
		...artists.map((a) => (category ? a.Categories[category] || 0 : a.TotalArtwork))
	);
	const _scale = d3.scaleLog().domain([0.1, maxCategoryValue]).range([0, 30]);
	const flowerCircleScale = (a) => _scale(category ? a.Categories[category] : a.TotalArtwork);

	const categoriesNames = categories.map((c) => c.Category);

	// Vis properties

	const flowerBase = 20;
	const flowerGroupWidth = 80;
	const flowerGroupHeight = 120;
	const svgHeight = flowerGroupHeight * Math.ceil(limitedArtists.length / 10);
	const flowersContainer = d3.select("#flowers");
	const mayBeSVG = flowersContainer.select("svg");
	const SVG = mayBeSVG.node() ? mayBeSVG : flowersContainer.append("svg");

	const mayBeTooltip = flowersContainer.select("#tooltip");
	const tooltip = mayBeTooltip.node()
		? mayBeTooltip
		: flowersContainer
				.append("div")
				.attr("id", "tooltip")
				.style("opacity", 0)
				.style("position", "absolute")
				.style("background-color", "white")
				.style("border", "solid")
				.style("border-width", "2px")
				.style("border-radius", "5px")
				.style("padding", "5px");

	const x0 = flowerGroupWidth / 2 - 10;
	const stemWidth = 8;
	const branchStart = 0.6;
	const flowerColor = d3.schemeTableau10[categoriesNames.indexOf(category)] || "white";

	SVG.attr("viewBox", `0 0 ${flowerGroupWidth * amountOfCols} ${svgHeight}`)
		.style("--color", flowerColor)
		.selectAll(".flower-container")
		.data(limitedArtists, (d) => d.Artist)
		.join(
			(enter) => {
				const flowerContainer = enter
					.append("g")
					.attr("class", "flower-container")
					.style("--size", (d) => flowerCircleScale(d, category))
					.attr("transform", (_, i) => {
						const x = (i % amountOfCols) * flowerGroupWidth;
						const y = Math.floor(i / amountOfCols) * flowerGroupHeight;
						return `translate(${x}, ${y})`;
					});

				const flowerDrawing = flowerContainer
					.append("g")
					.attr("class", "flower")
					.attr("transform", `translate(0, -${flowerBase})`);

				flowerContainer
					.append("rect")
					.attr("x", 0)
					.attr("y", flowerGroupHeight - flowerBase)
					.attr("width", flowerGroupWidth)
					.attr("height", flowerBase)
					.attr("fill", (d) =>
						d.Gender === "Male" ? "hsl(79, 100%, 90%)" : "hsl(328, 100%, 90%)"
					);

				flowerContainer
					.append("text")
					.attr("class", "artist-name")
					.text((d) => (d.Artist.length >= 11 ? d.Artist.slice(0, 7) + "..." : d.Artist))
					.attr("title", (d) => d.Artist)
					.attr("x", flowerGroupWidth / 2)
					.attr("y", flowerGroupHeight - flowerBase * 0.4)
					.attr("text-anchor", "middle")
					.attr("dominant-baseline", "middle");
				flowerContainer.on("mouseenter", (_, d) => {
					/** @type {Artist} */
					const { Artist, Nacionality, Age, BirthYear, Categories, Gender, TotalArtwork } = d;
					flowersContainer.style("--opacity", 0.3);
					tooltip.style("opacity", 1).html(null);
					tooltip
						.append("div")
						.attr("class", "artist-name")
						.text(Artist)
						.style("font-weight", "bold");
					tooltip.append("div").text(`Age: ${Age}`);
					tooltip.append("div").text(`Birth year: ${BirthYear}`);
					tooltip.append("div").text(`Nationality: ${Nacionality}`);
					tooltip.append("div").text(`Total artworks: ${TotalArtwork}`);
					tooltip.append("div").text(`Gender: ${Gender}`);
					tooltip
						.append("ul")
						.data([...Object.entries(Categories)])
						.append("li")
						.text(([c, a]) => `${c}: ${a}`);
				});
				flowerContainer.on("mouseleave", () => {
					flowersContainer.style("--opacity", 1);
					tooltip.style("opacity", 0);
				});
				flowerContainer.on("mousemove", (event, d) => {
					tooltip.style("left", `${event.pageX + 20}px`).style("top", `${event.pageY + 20}px`);
				});

				flowerDrawing
					.append("rect")
					.attr("x", x0 - stemWidth / 2)
					.attr("y", (d) => flowerGroupHeight - stemScale(d.Age))
					.attr("width", stemWidth)
					.attr("height", (d) => stemScale(d.Age));

				const branch = flowerDrawing.append("g");
				branch
					.append("line")
					.attr("x1", x0)
					.attr("y1", (d) => flowerGroupHeight - stemScale(d.Age) * branchStart)
					.attr("x2", x0 + 20)
					.attr("y2", (d) => flowerGroupHeight - stemScale(d.Age) * branchStart - 6)
					.attr("stroke", "black")
					.attr("stroke-width", 6);

				branch
					.filter((d) => d.DeathYear === -1)
					.append("ellipse")
					.attr("cx", x0 + 20)
					.attr("cy", (d) => flowerGroupHeight - stemScale(d.Age) * branchStart - 8)
					.attr("rx", 6)
					.attr("ry", 14) // Now rotate it in its center
					.attr("fill", "green")
					.style("transform-box", "fill-box")
					.style("transform-origin", "center")
					.style("transform", "rotate(60deg)");

				flowerDrawing
					.append("circle")
					.attr("cx", x0)
					.style("cy", (d) => `calc(${flowerGroupHeight + 10 - stemScale(d.Age)} - var(--size))`)
					.style("fill", "var(--color)")
					.style("r", "var(--size)");

				// if the category is not present, draw multiple flowers in order to fill the space

				if (category === "") {
					flowerDrawing
						.selectAll("circle")
						.data((d) => {
							const { Categories, Age } = d;
							const total = Object.values(Categories).reduce((a, b) => a + b, 0);
							const flowers = [];
							for (let i = 0; i < total; i++) {
								flowers.push({ Age });
							}
							return flowers;
						})
						.join("circle")
						.attr("cx", x0)
						.style("cy", (d) => `calc(${flowerGroupHeight + 10 - stemScale(d.Age)} - var(--size))`)
						.style("fill", d3.schemeTableau10[categoriesNames.indexOf(category)])
						.style("r", (d) => flowerCircleScale(d, category));
				}

				// Hacer que inicialmente la opacidad sea 0
				return flowerContainer
					.style("opacity", 0)
					.transition("fade")
					.style("opacity", 1)
					.transition("fade-in")
					.delay(1000)
					.style("opacity", null);
			},
			(update) => {
				console.log(update.node());
				// Hay que actualizar el tamaño de los círculos
				return update
					.style("--size", (d) => flowerCircleScale(d, category))
					.style("opacity", null)
					.transition()
					.attr("transform", (d, i) => {
						const x = (i % 10) * flowerGroupWidth;
						const y = Math.floor(i / 10) * flowerGroupHeight;
						return `translate(${x}, ${y})`;
					});
			},
			(exit) => exit.remove()
		);
}
