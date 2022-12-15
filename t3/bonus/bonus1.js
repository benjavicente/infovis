const DATA_LINK = (CategoryProcessedURL =
  "https://gist.githubusercontent.com/Hernan4444/b980e9a5457f180afb0783652d70f189/raw/fb251d45e5bc92826c75d23fe240533c1123c406/airbnb%2520-%2520bonus2.csv");
const MAP_LINK = (CategoryProcessedURL =
  "https://gist.githubusercontent.com/Hernan4444/b980e9a5457f180afb0783652d70f189/raw/a9052fc75d08472d839f60223b0de1e80857c66f/mygeodata.json");
const WIDTH = 400;
const HEIGHT = 400;

const SVG_MAPA = d3.select("#vis1").select("svg").attr("width", WIDTH).attr("height", HEIGHT);

d3.csv(DATA_LINK, d3.autoParse).then((dataset) => {
  d3.json(MAP_LINK).then((geojson) => {
    const categories = [...new Set(dataset.map((d) => d.tiempo_respuesta))];

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(categories);

    const projection = d3.geoMercator().fitSize([WIDTH, HEIGHT], geojson);

    const path = d3.geoPath().projection(projection);

    SVG_MAPA.append("g")
      .attr("class", "path-container")
      .selectAll("path")
      .data(geojson.features)
      .join("path")
      .attr("d", path)
      .attr("fill", "lightgray")
      .attr("stroke", "#0006");

    SVG_MAPA.append("g")
      .attr("class", "circle-container")
      .selectAll("circle")
      .data(dataset)
      .join("circle")
      .attr("fill", (d) => colorScale(d.tiempo_respuesta))
      .attr("opacity", 0.7)
      .attr("cx", (d) => projection([d.longitud, d.latitud])[0])
      .attr("cy", (d) => projection([d.longitud, d.latitud])[1])
      .attr("r", 3);

    SVG_MAPA.append("g")
      .attr("class", "category-legend")
      .attr("transform", `translate(10, 10)`)
      .selectAll(".category")
      .data(categories)
      .join((element) => {
        const g = element
          .append("g")
          .attr("class", "category")
          .attr("transform", (_, i) => `translate(0, ${i * 15})`);
        g.append("circle")
          .attr("fill", (d) => colorScale(d))
          .attr("r", 5)
          .attr("cx", 0)
          .attr("cy", 0);
        g.append("text")
          .text((d) => d)
          .attr("x", 10)
          .attr("y", 0)
          .attr("font-size", 12)
          .attr("alignment-baseline", "middle");
        return g;
      });
  });
});
