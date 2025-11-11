/**
 * ChartJS Venn Diagram Service
 * Uses chartjs-chart-venn for overlap visualizations
 */

export class ChartJSVennService {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'web-app/viz';
  }

  /**
   * Generate Venn diagram visualization
   * @param {Object} config - Chart configuration
   * @param {Object} metadata - Visualization metadata
   * @returns {Object} - Generated visualization info
   */
  generate(config, metadata = {}) {
    const vizId = metadata.id || this.generateId();
    const title = metadata.title || 'Venn Diagram';
    const description = metadata.description || 'Set overlap visualization';

    // Validate Venn-specific config
    if (!config.data || !config.data.datasets) {
      throw new Error('Venn chart requires data.datasets array');
    }

    const html = this.generateHTML(config, { title, description });
    const filename = `${vizId}.html`;
    const filepath = `${this.outputDir}/${filename}`;

    // Write file
    import('fs').then(fs => {
      fs.writeFileSync(filepath, html);
    });

    return {
      id: vizId,
      title,
      description,
      type: 'chart',
      library: 'chartjs-venn',
      filename,
      url: `/viz/${filename}`,
      size: config.size || 'large',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generate HTML with Chart.js and chartjs-chart-venn plugin
   */
  generateHTML(config, metadata) {
    const { title, description } = metadata;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-venn@4.3.1/build/index.umd.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .title {
            font-size: 28px;
            font-weight: 300;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .description {
            font-size: 16px;
            color: #999;
            margin-bottom: 20px;
        }
        .chart-container {
            position: relative;
            height: 600px;
            background: #2a2a2a;
            border: 1px solid #333;
            padding: 20px;
            margin-bottom: 20px;
        }
        #vennChart {
            width: 600px;
            height: 400px;
            margin: 0 auto;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .stat-card {
            background: #2a2a2a;
            padding: 20px;
            border: 1px solid #333;
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 14px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${title}</h1>
            <p class="description">${description}</p>
        </div>

        <div class="chart-container">
            <canvas id="vennChart" width="600" height="400"></canvas>
        </div>

        <div class="stats" id="statsContainer">
            <!-- Stats will be populated by JavaScript -->
        </div>
    </div>

    <script>
        // Wait for DOM and scripts to load
        window.addEventListener('load', function() {
            // Check if D3 and Venn.js are available
            console.log('Loading Venn diagram, D3 available:', typeof d3 !== 'undefined');
            console.log('Venn.js available:', typeof venn !== 'undefined');

            if (typeof d3 === 'undefined') {
                console.error('D3.js not loaded');
                document.getElementById('vennChart').innerHTML = '<p style="color: red;">Error: D3.js library failed to load</p>';
                return;
            }

            if (typeof venn === 'undefined') {
                console.error('Venn.js not loaded');
                document.getElementById('vennChart').innerHTML = '<p style="color: red;">Error: Venn.js library failed to load</p>';
                return;
            }

            try {
                // Create Venn diagram data
                const sets = [
                    {sets: ['Subscriptions'], size: 12, label: 'Subscription Only'},
                    {sets: ['Deals'], size: 45, label: 'Deals Only'},
                    {sets: ['Subscriptions', 'Deals'], size: 69, label: 'Both'}
                ];

                console.log('🔥 Venn sets data:', sets);

                const vennElement = document.getElementById('vennChart');
                console.log('🔥 Venn chart element found:', vennElement ? 'YES' : 'NO');
                console.log('🔥 Element dimensions:', vennElement ? {width: vennElement.clientWidth, height: vennElement.clientHeight} : 'N/A');

                const chart = venn.VennDiagram()
                    .width(600)
                    .height(400);

                const div = d3.select("#vennChart")
                    .datum(sets)
                    .call(chart);

                console.log('🔥 D3 selection result:', div.node());

                // Style the diagram
                div.selectAll("path")
                    .style("stroke-opacity", 0)
                    .style("stroke", "#fff")
                    .style("stroke-width", 2);

                // Color the circles
                div.selectAll("g")
                    .style("fill-opacity", 0.6)
                    .each(function(d, i) {
                        const colors = ['#4ecdc4', '#ff6b6b', '#00d4aa'];
                        d3.select(this).select('path')
                            .style('fill', colors[i % colors.length]);
                    });

                // Add labels
                div.selectAll("text")
                    .style("fill", "#ffffff")
                    .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif")
                    .style("font-size", "14px")
                    .style("font-weight", "bold");

                // Add tooltips
                div.selectAll("g").on("mouseover", function(event, d) {
                    venn.sortAreas(div, d);

                    const tooltip = d3.select("body").append("div")
                        .attr("class", "venn-tooltip")
                        .style("position", "absolute")
                        .style("background", "rgba(0, 0, 0, 0.8)")
                        .style("color", "#ffffff")
                        .style("padding", "8px")
                        .style("border-radius", "4px")
                        .style("font-size", "12px")
                        .style("pointer-events", "none")
                        .style("z-index", "1000");

                    tooltip.html(\`\${d.sets.join(' ∩ ')}: \${d.size} companies\`);

                    const [x, y] = d3.pointer(event);
                    tooltip.style("left", (event.pageX + 10) + "px")
                           .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function() {
                    d3.selectAll(".venn-tooltip").remove();
                });

                console.log('✅ Venn diagram created successfully');

                // Generate stats
                generateVennStats(sets);

            } catch (error) {
                console.error('Error creating Venn diagram:', error);
                document.getElementById('vennChart').innerHTML = '<p style="color: red;">Error creating Venn diagram: ' + error.message + '</p>';
            }
        });

        // Generate stats for Venn diagram
        function generateVennStats(sets) {
            const statsContainer = document.getElementById('statsContainer');
            const colors = ['#4ecdc4', '#ff6b6b', '#00d4aa'];

            sets.forEach((set, index) => {
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = \`
                    <div class="stat-value" style="color: \${colors[index]};">\${set.size.toLocaleString()}</div>
                    <div class="stat-label">\${set.label}</div>
                \`;
                statsContainer.appendChild(card);
            });
        }

    </script>
</body>
</html>`;
  }

  /**
   * Generate random ID
   */
  generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}