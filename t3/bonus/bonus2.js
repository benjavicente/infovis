const DATA2_LINK =
  "https://gist.githubusercontent.com/Hernan4444/b980e9a5457f180afb0783652d70f189/raw/fb251d45e5bc92826c75d23fe240533c1123c406/airbnb%2520-%2520bonus2.csv";
const WIDTH_2 = 600;
const HEIGHT_2 = 400;

const SVG_BAARRA = d3.select("#vis2").select("svg").attr("width", WIDTH_2).attr("height", HEIGHT_2);

d3.csv(DATA2_LINK, d3.autoParse).then((dataset) => {
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  const getBedsBucket = (camas) => {
    if (1 <= camas && camas <= 2) return "1 a 2";
    if (3 <= camas && camas <= 4) return "3 a 4";
    if (5 <= camas && camas <= 8) return "5 a 8";
    if (9 <= camas) return "9 o más";
    throw new Error("Invalid value");
  };

  const dictData = dataset.reduce((acc, current, i) => {
    const bucket = getBedsBucket(+current.camas);
    if (bucket in acc) {
      acc[bucket] += 1;
    } else {
      acc[bucket] = 1;
    }
    return acc;
  }, {});

  const data = Object.entries(dictData).map(([bedBucket, amount]) => ({ bedBucket, amount }));

  const yScale = d3
    .scaleLog()
    .domain([1, d3.max(data, (d) => d.amount)])
    .range([HEIGHT_2 - margin.bottom, margin.top]);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.bedBucket))
    .range([margin.left, WIDTH_2 - margin.right])
    .padding([0.1]);

  SVG_BAARRA.append("g")
    .attr("transform", `translate(0, ${HEIGHT_2 - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  SVG_BAARRA.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(yScale));

  SVG_BAARRA.append("g")
    .data(data)
    .enter()
    .append("text")
    .attr("x", (d) => xScale(d.bedBucket))
    .attr("y", (d) => yScale(d.amount))
    .text((d) => d.amount)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "white");

  SVG_BAARRA.append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", (d) => xScale(d.bedBucket))
    .attr("y", (d) => yScale(d.amount))
    .attr("height", (d) => yScale(1) - yScale(d.amount))
    .attr("width", xScale.bandwidth())
    .attr("fill", "orange");
});
