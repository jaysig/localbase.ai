/**
 * chartjs-chart-venn
 * https://github.com/upsetjs/chartjs-chart-venn
 *
 * Copyright (c) 2019-2023 Samuel Gratzl <sam@sgratzl.com>
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('chart.js')) :
    typeof define === 'function' && define.amd ? define(['exports', 'chart.js'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ChartVenn = {}, global.Chart));
})(this, (function (exports, chart_js) { 'use strict';

    function isEllipse(d) {
        return typeof d.rx === 'number';
    }

    function generateArcSlicePath(s, refs, p = 0) {
        if (s.path) {
            return s.path;
        }
        return `M ${s.x1 - p},${s.y1 - p} ${s.arcs
        .map((arc) => {
        const ref = refs[arc.ref];
        const rx = isEllipse(ref) ? ref.rx : ref.r;
        const ry = isEllipse(ref) ? ref.ry : ref.r;
        const rot = isEllipse(ref) ? ref.rotation : 0;
        return `A ${rx - p} ${ry - p} ${rot} ${arc.large ? 1 : 0} ${arc.sweep ? 1 : 0} ${arc.x2 - p} ${arc.y2 - p}`;
    })
        .join(' ')}`;
    }

    function len(x, y) {
        return Math.sqrt(x * x + y * y);
    }
    function dist(a, b) {
        return len(a.cx - b.cx, a.cy - b.cy);
    }
    const DEG2RAD = (1 / 180) * Math.PI;
    function pointAtCircle(cx, cy, radius, angle) {
        return {
            x: cx + Math.cos(angle * DEG2RAD) * radius,
            y: cy + Math.sin(angle * DEG2RAD) * radius,
        };
    }

    class ArcSlice extends chart_js.Element {
        inRange(mouseX, mouseY) {
            var _a;
            const props = this.getProps(['arcs', 'refs', 'sets']);
            const usedSets = new Set(props.sets);
            function checkRef(p, ref, inside) {
                if (isEllipse(ref)) {
                    const a = ref.rotation * DEG2RAD;
                    const x = p.cx - ref.cx;
                    const y = p.cy - ref.cy;
                    const d = (x * Math.cos(a) + y * Math.sin(a)) ** 2 / ref.rx ** 2 +
                        (x * Math.sin(a) - y * Math.cos(a)) ** 2 / ref.ry ** 2;
                    if ((inside && d > 1) || (!inside && d < 1)) {
                        return false;
                    }
                }
                else {
                    const d = dist(p, ref);
                    if ((inside && d > ref.r) || (!inside && d < ref.r)) {
                        return false;
                    }
                }
                return true;
            }
            for (const arc of (_a = props.arcs) !== null && _a !== void 0 ? _a : []) {
                const ref = props.refs[arc.ref];
                const p = {
                    cx: Number.isNaN(mouseX) ? ref.cx : mouseX,
                    cy: Number.isNaN(mouseY) ? ref.cy : mouseY,
                };
                usedSets.delete(arc.ref);
                if (!checkRef(p, ref, arc.mode === 'i')) {
                    return false;
                }
            }
            const remaining = Array.from(usedSets);
            for (let i = 0; i < remaining.length; i += 1) {
                const ref = props.refs[remaining[i]];
                const p = {
                    cx: Number.isNaN(mouseX) ? ref.cx : mouseX,
                    cy: Number.isNaN(mouseY) ? ref.cy : mouseY,
                };
                if (!checkRef(p, ref, true)) {
                    return false;
                }
            }
            return true;
        }
        inXRange(mouseX) {
            return this.inRange(mouseX, Number.NaN);
        }
        inYRange(mouseY) {
            return this.inRange(Number.NaN, mouseY);
        }
        getCenterPoint() {
            const arc = this.getProps(['text']);
            return arc.text;
        }
        tooltipPosition() {
            return this.getCenterPoint();
        }
        hasValue() {
            return true;
        }
        draw(ctx) {
            ctx.save();
            const options = this.options;
            const props = this.getProps(['x1', 'y1', 'arcs', 'refs']);
            ctx.beginPath();
            let path;
            if (window.Path2D) {
                path = new Path2D(generateArcSlicePath(props, props.refs));
            }
            else {
                ctx.beginPath();
                ctx.moveTo(props.x1, props.y1);
                for (const arc of props.arcs) {
                    const ref = props.refs[arc.ref];
                    const rx = isEllipse(ref) ? ref.rx : ref.r;
                    const ry = isEllipse(ref) ? ref.ry : ref.r;
                    const rot = isEllipse(ref) ? ref.rotation : 0;
                    ctx.ellipse(ref.cx, ref.cy, rx, ry, rot, 0, Math.PI * 2, !arc.sweep);
                }
                ctx.closePath();
            }
            if (options.backgroundColor) {
                ctx.fillStyle = options.backgroundColor;
                if (path) {
                    ctx.fill(path);
                }
                else {
                    ctx.fill();
                }
            }
            if (options.borderColor) {
                ctx.strokeStyle = options.borderColor;
                ctx.lineWidth = options.borderWidth;
                if (path) {
                    ctx.stroke(path);
                }
                else {
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }
    ArcSlice.id = 'arcSlice';
    ArcSlice.defaults = { ...chart_js.BarElement.defaults, backgroundColor: '#efefef' };
    ArcSlice.defaultRoutes = {
        borderColor: 'borderColor',
    };

    var sets$5 = [
    ];
    var intersections$5 = [
    ];
    var bb$5 = {
    	x: 0,
    	y: 0,
    	width: 10,
    	height: 10
    };
    var venn0 = {
    	sets: sets$5,
    	intersections: intersections$5,
    	bb: bb$5
    };

    var sets$4 = [
    	{
    		cx: 0,
    		cy: 0,
    		r: 5,
    		text: {
    			x: 3.5,
    			y: -4
    		},
    		align: "start",
    		verticalAlign: "bottom"
    	}
    ];
    var intersections$4 = [
    	{
    		sets: [
    			0
    		],
    		x1: 0,
    		y1: 5,
    		arcs: [
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: -5,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: 5,
    				sweep: false,
    				large: false
    			}
    		],
    		text: {
    			x: 0,
    			y: 0
    		}
    	}
    ];
    var bb$4 = {
    	x: -5,
    	y: -5,
    	width: 10,
    	height: 10
    };
    var venn1 = {
    	sets: sets$4,
    	intersections: intersections$4,
    	bb: bb$4
    };

    var sets$3 = [
    	{
    		cx: -4,
    		cy: 0,
    		r: 5,
    		text: {
    			x: -7.5,
    			y: 4
    		},
    		align: "end",
    		verticalAlign: "top"
    	},
    	{
    		cx: 4,
    		cy: 0,
    		r: 5,
    		text: {
    			x: 7.5,
    			y: -4
    		},
    		align: "start",
    		verticalAlign: "bottom"
    	}
    ];
    var intersections$3 = [
    	{
    		sets: [
    			0
    		],
    		x1: 0,
    		y1: -3,
    		arcs: [
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: 3,
    				sweep: false,
    				large: true
    			},
    			{
    				mode: "o",
    				ref: 1,
    				x2: 0,
    				y2: -3,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: -4,
    			y: 0
    		}
    	},
    	{
    		sets: [
    			1
    		],
    		x1: 0,
    		y1: 3,
    		arcs: [
    			{
    				mode: "i",
    				ref: 1,
    				x2: 0,
    				y2: -3,
    				sweep: false,
    				large: true
    			},
    			{
    				mode: "o",
    				ref: 0,
    				x2: 0,
    				y2: 3,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: 4,
    			y: 0
    		}
    	},
    	{
    		sets: [
    			0,
    			1
    		],
    		x1: 0,
    		y1: 3,
    		arcs: [
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: -3,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 1,
    				x2: 0,
    				y2: 3,
    				sweep: false,
    				large: false
    			}
    		],
    		text: {
    			x: 0,
    			y: 0
    		}
    	}
    ];
    var bb$3 = {
    	x: -9,
    	y: -5,
    	width: 18,
    	height: 10
    };
    var venn2 = {
    	sets: sets$3,
    	intersections: intersections$3,
    	bb: bb$3
    };

    var sets$2 = [
    	{
    		cx: -3.464,
    		cy: -2,
    		r: 5,
    		text: {
    			x: -7,
    			y: -6
    		},
    		align: "end"
    	},
    	{
    		cx: 3.464,
    		cy: -2,
    		r: 5,
    		text: {
    			x: 7,
    			y: -6
    		},
    		align: "start"
    	},
    	{
    		cx: 0,
    		cy: 4,
    		r: 5,
    		text: {
    			x: 4,
    			y: 7.5
    		},
    		align: "start",
    		verticalAlign: "top"
    	}
    ];
    var intersections$2 = [
    	{
    		sets: [
    			0
    		],
    		x1: -4.855,
    		y1: 2.803,
    		arcs: [
    			{
    				mode: "o",
    				ref: 2,
    				x2: -1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 1,
    				x2: 0,
    				y2: -5.606,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 0,
    				x2: -4.855,
    				y2: 2.803,
    				sweep: false,
    				large: true
    			}
    		],
    		text: {
    			x: -4.216,
    			y: -2.434
    		}
    	},
    	{
    		sets: [
    			1
    		],
    		x1: 0,
    		y1: -5.606,
    		arcs: [
    			{
    				mode: "o",
    				ref: 0,
    				x2: 1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 2,
    				x2: 4.855,
    				y2: 2.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 1,
    				x2: 0,
    				y2: -5.606,
    				sweep: false,
    				large: true
    			}
    		],
    		text: {
    			x: 4.216,
    			y: -2.434
    		}
    	},
    	{
    		sets: [
    			2
    		],
    		x1: -4.855,
    		y1: 2.803,
    		arcs: [
    			{
    				mode: "o",
    				ref: 0,
    				x2: 0,
    				y2: 1.606,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 1,
    				x2: 4.855,
    				y2: 2.803,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 2,
    				x2: -4.855,
    				y2: 2.803,
    				sweep: true,
    				large: true
    			}
    		],
    		text: {
    			x: 0,
    			y: 4.869
    		}
    	},
    	{
    		sets: [
    			0,
    			1
    		],
    		x1: 0,
    		y1: -5.606,
    		arcs: [
    			{
    				mode: "i",
    				ref: 1,
    				x2: -1.39,
    				y2: -0.803,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 2,
    				x2: 1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: -5.606,
    				sweep: false,
    				large: false
    			}
    		],
    		text: {
    			x: 0,
    			y: -2.404
    		}
    	},
    	{
    		sets: [
    			0,
    			2
    		],
    		x1: -4.855,
    		y1: 2.803,
    		arcs: [
    			{
    				mode: "i",
    				ref: 2,
    				x2: -1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 1,
    				x2: 0,
    				y2: 1.606,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 0,
    				x2: -4.855,
    				y2: 2.803,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: -2.082,
    			y: 1.202
    		}
    	},
    	{
    		sets: [
    			1,
    			2
    		],
    		x1: 4.855,
    		y1: 2.803,
    		arcs: [
    			{
    				mode: "i",
    				ref: 2,
    				x2: 1.39,
    				y2: -0.803,
    				sweep: false,
    				large: false
    			},
    			{
    				mode: "o",
    				ref: 0,
    				x2: 0,
    				y2: 1.606,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 1,
    				x2: 4.855,
    				y2: 2.803,
    				sweep: false,
    				large: false
    			}
    		],
    		text: {
    			x: 2.082,
    			y: 1.202
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2
    		],
    		x1: 1.39,
    		y1: -0.803,
    		arcs: [
    			{
    				mode: "i",
    				ref: 0,
    				x2: 0,
    				y2: 1.606,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 1,
    				x2: -1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			},
    			{
    				mode: "i",
    				ref: 2,
    				x2: 1.39,
    				y2: -0.803,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: 0,
    			y: 0
    		}
    	}
    ];
    var bb$2 = {
    	x: -8.464,
    	y: -7,
    	width: 16.928,
    	height: 16
    };
    var venn3 = {
    	sets: sets$2,
    	intersections: intersections$2,
    	bb: bb$2
    };

    var sets$1 = [
    	{
    		cx: 0.439,
    		cy: -1.061,
    		rx: 2.5,
    		ry: 5,
    		rotation: 45,
    		text: {
    			x: 4.5,
    			y: -4.5
    		},
    		align: "start",
    		verticalAlign: "bottom"
    	},
    	{
    		cx: 2.561,
    		cy: 1.061,
    		rx: 2.5,
    		ry: 5,
    		rotation: 45,
    		text: {
    			x: 4,
    			y: 3.75
    		},
    		align: "start",
    		verticalAlign: "top"
    	},
    	{
    		cx: -2.561,
    		cy: 1.061,
    		rx: 2.5,
    		ry: 5,
    		rotation: -45,
    		text: {
    			x: -4,
    			y: 3.7
    		},
    		align: "end",
    		verticalAlign: "top"
    	},
    	{
    		cx: -0.439,
    		cy: -1.061,
    		rx: 2.5,
    		ry: 5,
    		rotation: -45,
    		text: {
    			x: -4.5,
    			y: -4.5
    		},
    		align: "end",
    		verticalAlign: "bottom"
    	}
    ];
    var intersections$1 = [
    	{
    		sets: [
    			0
    		],
    		x1: 0,
    		y1: -3.94,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: 4.328,
    				y2: -2.828,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 2.179,
    				y2: -1.858,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 0,
    				y2: -3.94,
    				large: false
    			}
    		],
    		text: {
    			x: 2.914,
    			y: -3.536
    		}
    	},
    	{
    		sets: [
    			1
    		],
    		x1: 4.328,
    		y1: -2.828,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: 0,
    				y2: 5.006,
    				sweep: true,
    				large: true
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 1.328,
    				y2: 2.828
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 3.108,
    				y2: -0.328
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 4.328,
    				y2: -2.828
    			}
    		],
    		text: {
    			x: 5.036,
    			y: -1.414
    		}
    	},
    	{
    		sets: [
    			2
    		],
    		x1: 0,
    		y1: 5.006,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: -4.328,
    				y2: -2.828,
    				sweep: true,
    				large: true
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -3.108,
    				y2: -0.328
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -1.328,
    				y2: 2.828
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 0,
    				y2: 5.006
    			}
    		],
    		text: {
    			x: -5.036,
    			y: -1.414
    		}
    	},
    	{
    		sets: [
    			3
    		],
    		x1: -4.328,
    		y1: -2.828,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 0,
    				y2: -3.94,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -2.179,
    				y2: -1.858,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -4.328,
    				y2: -2.828,
    				large: false
    			}
    		],
    		text: {
    			x: -2.914,
    			y: -3.536
    		}
    	},
    	{
    		sets: [
    			0,
    			1
    		],
    		x1: 4.328,
    		y1: -2.828,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: 3.108,
    				y2: -0.328,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 2.179,
    				y2: -1.858,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 4.328,
    				y2: -2.828,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: 3.205,
    			y: -1.672
    		}
    	},
    	{
    		sets: [
    			0,
    			2
    		],
    		x1: -1.328,
    		y1: 2.828,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: -3.108,
    				y2: -0.328,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -0.969,
    				y2: 1.755,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -1.328,
    				y2: 2.828,
    				large: false
    			}
    		],
    		text: {
    			x: -2.212,
    			y: 1.591
    		}
    	},
    	{
    		sets: [
    			0,
    			3
    		],
    		x1: 0,
    		y1: -3.94,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 2.179,
    				y2: -1.858,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 0,
    				y2: 0.188,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -2.179,
    				y2: -1.858,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 0,
    				y2: -3.94,
    				sweep: true
    			}
    		],
    		text: {
    			x: 0,
    			y: -1.87
    		}
    	},
    	{
    		sets: [
    			1,
    			2
    		],
    		x1: 1.328,
    		y1: 2.828,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 0,
    				y2: 5.006,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -1.328,
    				y2: 2.828,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 0,
    				y2: 2.346,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 1.328,
    				y2: 2.828
    			}
    		],
    		text: {
    			x: 0,
    			y: 3.393
    		}
    	},
    	{
    		sets: [
    			1,
    			3
    		],
    		x1: 3.108,
    		y1: -0.328,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 1.328,
    				y2: 2.828,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 0.969,
    				y2: 1.755,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 3.108,
    				y2: -0.328,
    				large: false
    			}
    		],
    		text: {
    			x: 2.212,
    			y: 1.591
    		}
    	},
    	{
    		sets: [
    			2,
    			3
    		],
    		x1: -3.108,
    		y1: -0.328,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -4.328,
    				y2: -2.828,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: -2.179,
    				y2: -1.858,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -3.108,
    				y2: -0.328,
    				large: false
    			}
    		],
    		text: {
    			x: -3.205,
    			y: -1.672
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2
    		],
    		x1: 0,
    		y1: 2.346,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1.328,
    				y2: 2.828,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -0.969,
    				y2: 1.755,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 0,
    				y2: 2.346,
    				large: false
    			}
    		],
    		text: {
    			x: -0.766,
    			y: 2.31
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			3
    		],
    		x1: 2.179,
    		y1: -1.858,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 3.108,
    				y2: -0.328,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 0.969,
    				y2: 1.755,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 0,
    				y2: 0.188,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 2.179,
    				y2: -1.858,
    				sweep: true
    			}
    		],
    		text: {
    			x: 1.558,
    			y: -0.056
    		}
    	},
    	{
    		sets: [
    			0,
    			2,
    			3
    		],
    		x1: -0.969,
    		y1: 1.755,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -3.108,
    				y2: -0.328,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -2.179,
    				y2: -1.858,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: 0,
    				y2: 0.188,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -0.969,
    				y2: 1.755
    			}
    		],
    		text: {
    			x: -1.558,
    			y: -0.056
    		}
    	},
    	{
    		sets: [
    			1,
    			2,
    			3
    		],
    		x1: 1.328,
    		y1: 2.828,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 0,
    				y2: 2.346,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 0.969,
    				y2: 1.755,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: 1.328,
    				y2: 2.828,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: 0.766,
    			y: 2.31
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2,
    			3
    		],
    		x1: 0,
    		y1: 0.188,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 0.969,
    				y2: 1.755,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 0,
    				y2: 2.346,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: -0.969,
    				y2: 1.755,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 0,
    				y2: 0.188,
    				sweep: true
    			}
    		],
    		text: {
    			x: 0,
    			y: 1.43
    		}
    	}
    ];
    var bb$1 = {
    	x: -6.5,
    	y: -5,
    	width: 13,
    	height: 10
    };
    var venn4 = {
    	sets: sets$1,
    	intersections: intersections$1,
    	bb: bb$1
    };

    var sets = [
    	{
    		cx: 0.5,
    		cy: -1,
    		rx: 2.5,
    		ry: 5,
    		rotation: 0,
    		text: {
    			x: 2.25,
    			y: -5
    		},
    		align: "start",
    		verticalAlign: "bottom"
    	},
    	{
    		cx: 1.106,
    		cy: 0.167,
    		rx: 2.5,
    		ry: 5,
    		rotation: 72,
    		text: {
    			x: 4.5,
    			y: 1.5
    		},
    		align: "start",
    		verticalAlign: "top"
    	},
    	{
    		cx: 0.183,
    		cy: 1.103,
    		rx: 2.5,
    		ry: 5,
    		rotation: 144,
    		text: {
    			x: 4,
    			y: 4
    		},
    		align: "start",
    		verticalAlign: "bottom"
    	},
    	{
    		cx: -0.992,
    		cy: 0.515,
    		rx: 2.5,
    		ry: 5,
    		rotation: 216,
    		text: {
    			x: -4.7,
    			y: 2
    		},
    		align: "end",
    		verticalAlign: "bottom"
    	},
    	{
    		cx: -0.797,
    		cy: -0.785,
    		rx: 2.5,
    		ry: 5,
    		rotation: 288,
    		text: {
    			x: -4,
    			y: -3.6
    		},
    		align: "end",
    		verticalAlign: "bottom"
    	}
    ];
    var intersections = [
    	{
    		sets: [
    			0
    		],
    		x1: -1.653,
    		y1: -3.541,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: 2.857,
    				y2: -2.666,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 2.5,
    				y2: -2.648,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -0.495,
    				y2: -3.303,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: -1.653,
    				y2: -3.541
    			}
    		],
    		text: {
    			x: 0.5,
    			y: -5
    		}
    	},
    	{
    		sets: [
    			1
    		],
    		x1: 2.857,
    		y1: -2.666,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: 3.419,
    				y2: 1.893,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 3.291,
    				y2: 1.559,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 2.988,
    				y2: -1.492,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 2.857,
    				y2: -2.666
    			}
    		],
    		text: {
    			x: 4.91,
    			y: -1.07
    		}
    	},
    	{
    		sets: [
    			2
    		],
    		x1: 3.419,
    		y1: 1.893,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: -0.744,
    				y2: 3.837,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -0.466,
    				y2: 3.612,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 2.342,
    				y2: 2.381,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 3.419,
    				y2: 1.893
    			}
    		],
    		text: {
    			x: 2.534,
    			y: 4.339
    		}
    	},
    	{
    		sets: [
    			3
    		],
    		x1: -0.744,
    		y1: 3.837,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -3.879,
    				y2: 0.478,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: -3.579,
    				y2: 0.673,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -1.54,
    				y2: 2.963,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -0.744,
    				y2: 3.837
    			}
    		],
    		text: {
    			x: -3.343,
    			y: 3.751
    		}
    	},
    	{
    		sets: [
    			4
    		],
    		x1: -3.879,
    		y1: 0.478,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: -1.653,
    				y2: -3.541,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -1.746,
    				y2: -3.196,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -3.294,
    				y2: -0.549,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -3.879,
    				y2: 0.478
    			}
    		],
    		text: {
    			x: -4.601,
    			y: -2.021
    		}
    	},
    	{
    		sets: [
    			0,
    			1
    		],
    		x1: 2.5,
    		y1: -2.648,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: 2.857,
    				y2: -2.666,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 2.988,
    				y2: -1.492,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 2.572,
    				y2: -1.839,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 2.5,
    				y2: -2.648
    			}
    		],
    		text: {
    			x: 2.741,
    			y: -2.152
    		}
    	},
    	{
    		sets: [
    			0,
    			2
    		],
    		x1: 2.342,
    		y1: 2.381,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: -0.466,
    				y2: 3.612,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 0.257,
    				y2: 2.922,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 2.342,
    				y2: 2.381,
    				large: false
    			}
    		],
    		text: {
    			x: 0.5,
    			y: 3.5
    		}
    	},
    	{
    		sets: [
    			0,
    			3
    		],
    		x1: -0.495,
    		y1: -3.303,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 2.5,
    				y2: -2.648,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 1.51,
    				y2: -2.515,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: -0.495,
    				y2: -3.303,
    				large: false
    			}
    		],
    		text: {
    			x: 1.653,
    			y: -3.125
    		}
    	},
    	{
    		sets: [
    			0,
    			4
    		],
    		x1: -1.653,
    		y1: -3.541,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: -0.495,
    				y2: -3.303,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -0.954,
    				y2: -3.015,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -1.746,
    				y2: -3.196,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1.653,
    				y2: -3.541
    			}
    		],
    		text: {
    			x: -1.199,
    			y: -3.272
    		}
    	},
    	{
    		sets: [
    			1,
    			2
    		],
    		x1: 3.291,
    		y1: 1.559,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 3.419,
    				y2: 1.893,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 2.342,
    				y2: 2.381,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 2.544,
    				y2: 1.878,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 3.291,
    				y2: 1.559
    			}
    		],
    		text: {
    			x: 2.894,
    			y: 1.942
    		}
    	},
    	{
    		sets: [
    			1,
    			3
    		],
    		x1: -1.54,
    		y1: 2.963,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: -3.579,
    				y2: 0.673,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: -2.7,
    				y2: 1.147,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -1.54,
    				y2: 2.963,
    				large: false
    			}
    		],
    		text: {
    			x: -3.174,
    			y: 1.557
    		}
    	},
    	{
    		sets: [
    			1,
    			4
    		],
    		x1: 2.988,
    		y1: -1.492,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: 3.291,
    				y2: 1.559,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 2.858,
    				y2: 0.659,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 2.988,
    				y2: -1.492,
    				large: false
    			}
    		],
    		text: {
    			x: 3.483,
    			y: 0.606
    		}
    	},
    	{
    		sets: [
    			2,
    			3
    		],
    		x1: -0.466,
    		y1: 3.612,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -0.744,
    				y2: 3.837,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: -1.54,
    				y2: 2.963,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -1,
    				y2: 3,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -0.466,
    				y2: 3.612
    			}
    		],
    		text: {
    			x: -0.953,
    			y: 3.352
    		}
    	},
    	{
    		sets: [
    			2,
    			4
    		],
    		x1: -3.294,
    		y1: -0.549,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: -1.746,
    				y2: -3.196,
    				sweep: true
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -1.925,
    				y2: -2.213
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -3.294,
    				y2: -0.549
    			}
    		],
    		text: {
    			x: -2.462,
    			y: -2.538
    		}
    	},
    	{
    		sets: [
    			3,
    			4
    		],
    		x1: -3.579,
    		y1: 0.673,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: -3.879,
    				y2: 0.478,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: -3.294,
    				y2: -0.549,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -3.162,
    				y2: -0.024,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -3.579,
    				y2: 0.673
    			}
    		],
    		text: {
    			x: -3.483,
    			y: 0.13
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2
    		],
    		x1: 2.544,
    		y1: 1.878,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: 2.342,
    				y2: 2.381,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 0.257,
    				y2: 2.922,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 0.983,
    				y2: 2.049,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 2.544,
    				y2: 1.878
    			}
    		],
    		text: {
    			x: 1.457,
    			y: 2.331
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			3
    		],
    		x1: 1.51,
    		y1: -2.515,
    		arcs: [
    			{
    				ref: 1,
    				mode: "i",
    				x2: 2.5,
    				y2: -2.648,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: 2.572,
    				y2: -1.839,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 1.51,
    				y2: -2.515,
    				large: false
    			}
    		],
    		text: {
    			x: 2.194,
    			y: -2.334
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			4
    		],
    		x1: 2.572,
    		y1: -1.839,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: 2.988,
    				y2: -1.492,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 2.858,
    				y2: 0.659,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 2.253,
    				y2: -0.302,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 2.572,
    				y2: -1.839
    			}
    		],
    		text: {
    			x: 2.667,
    			y: -0.665
    		}
    	},
    	{
    		sets: [
    			0,
    			2,
    			3
    		],
    		x1: 0.257,
    		y1: 2.922,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -0.466,
    				y2: 3.612,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1,
    				y2: 3,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 0.257,
    				y2: 2.922,
    				large: false
    			}
    		],
    		text: {
    			x: -0.403,
    			y: 3.178
    		}
    	},
    	{
    		sets: [
    			0,
    			2,
    			4
    		],
    		x1: -1.746,
    		y1: -3.196,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: -0.954,
    				y2: -3.015,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: -1.925,
    				y2: -2.213,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1.746,
    				y2: -3.196,
    				sweep: true,
    				large: false
    			}
    		],
    		text: {
    			x: -1.542,
    			y: -2.808
    		}
    	},
    	{
    		sets: [
    			0,
    			3,
    			4
    		],
    		x1: -0.495,
    		y1: -3.303,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: 1.51,
    				y2: -2.515,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: 0.409,
    				y2: -2.236,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -0.954,
    				y2: -3.015,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: -0.495,
    				y2: -3.303
    			}
    		],
    		text: {
    			x: 0.192,
    			y: -2.742
    		}
    	},
    	{
    		sets: [
    			1,
    			2,
    			3
    		],
    		x1: -1.54,
    		y1: 2.963,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: -2.7,
    				y2: 1.147,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: -1.645,
    				y2: 1.568,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -1,
    				y2: 3,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -1.54,
    				y2: 2.963
    			}
    		],
    		text: {
    			x: -1.767,
    			y: 2.106
    		}
    	},
    	{
    		sets: [
    			1,
    			2,
    			4
    		],
    		x1: 2.858,
    		y1: 0.659,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 3.291,
    				y2: 1.559,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "i",
    				x2: 2.544,
    				y2: 1.878,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: 2.858,
    				y2: 0.659,
    				large: false
    			}
    		],
    		text: {
    			x: 2.898,
    			y: 1.365
    		}
    	},
    	{
    		sets: [
    			1,
    			3,
    			4
    		],
    		x1: -2.7,
    		y1: 1.147,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: -3.579,
    				y2: 0.673,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -3.162,
    				y2: -0.024,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: -2.7,
    				y2: 1.147,
    				large: false
    			}
    		],
    		text: {
    			x: -3.147,
    			y: 0.599
    		}
    	},
    	{
    		sets: [
    			2,
    			3,
    			4
    		],
    		x1: -3.294,
    		y1: -0.549,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: -1.925,
    				y2: -2.213,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -2,
    				y2: -1.08,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -3.162,
    				y2: -0.024,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: -3.294,
    				y2: -0.549
    			}
    		],
    		text: {
    			x: -2.548,
    			y: -1.029
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2,
    			3
    		],
    		x1: 0.983,
    		y1: 2.049,
    		arcs: [
    			{
    				ref: 3,
    				mode: "i",
    				x2: 0.257,
    				y2: 2.922,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -1,
    				y2: 3,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1.645,
    				y2: 1.568,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "o",
    				x2: 0.983,
    				y2: 2.049
    			}
    		],
    		text: {
    			x: -0.407,
    			y: 2.31
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2,
    			4
    		],
    		x1: 2.253,
    		y1: -0.302,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 2.858,
    				y2: 0.659,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: 2.544,
    				y2: 1.878,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "i",
    				x2: 0.983,
    				y2: 2.049,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "o",
    				x2: 2.253,
    				y2: -0.302
    			}
    		],
    		text: {
    			x: 2.071,
    			y: 1.101
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			3,
    			4
    		],
    		x1: 1.51,
    		y1: -2.515,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: 2.572,
    				y2: -1.839,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: 2.253,
    				y2: -0.302,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "o",
    				x2: 0.409,
    				y2: -2.236,
    				sweep: false,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 1.51,
    				y2: -2.515,
    				sweep: true
    			}
    		],
    		text: {
    			x: 1.687,
    			y: -1.63
    		}
    	},
    	{
    		sets: [
    			0,
    			2,
    			3,
    			4
    		],
    		x1: -2,
    		y1: -1.08,
    		arcs: [
    			{
    				ref: 0,
    				mode: "i",
    				x2: -1.925,
    				y2: -2.213,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: -0.954,
    				y2: -3.015,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: 0.409,
    				y2: -2.236,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "o",
    				x2: -2,
    				y2: -1.08
    			}
    		],
    		text: {
    			x: -1.028,
    			y: -2.108
    		}
    	},
    	{
    		sets: [
    			1,
    			2,
    			3,
    			4
    		],
    		x1: -1.645,
    		y1: 1.568,
    		arcs: [
    			{
    				ref: 4,
    				mode: "i",
    				x2: -2.7,
    				y2: 1.147,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 2,
    				mode: "i",
    				x2: -3.162,
    				y2: -0.024,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: -2,
    				y2: -1.08,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "o",
    				x2: -1.645,
    				y2: 1.568
    			}
    		],
    		text: {
    			x: -2.323,
    			y: 0.327
    		}
    	},
    	{
    		sets: [
    			0,
    			1,
    			2,
    			3,
    			4
    		],
    		x1: 0.409,
    		y1: -2.236,
    		arcs: [
    			{
    				ref: 2,
    				mode: "i",
    				x2: 2.253,
    				y2: -0.302,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 3,
    				mode: "i",
    				x2: 0.983,
    				y2: 2.049,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 4,
    				mode: "i",
    				x2: -1.645,
    				y2: 1.568,
    				sweep: true,
    				large: false
    			},
    			{
    				ref: 0,
    				mode: "i",
    				x2: -2,
    				y2: -1.08,
    				sweep: true
    			},
    			{
    				ref: 1,
    				mode: "i",
    				x2: 0.409,
    				y2: -2.236,
    				sweep: true
    			}
    		],
    		text: {
    			x: 0,
    			y: 0
    		}
    	}
    ];
    var bb = {
    	x: -5.5,
    	y: -6,
    	width: 11.6,
    	height: 11.8
    };
    var venn5 = {
    	sets: sets,
    	intersections: intersections,
    	bb: bb
    };

    function layout$1(sets, bb) {
        const lookup = [venn0, venn1, venn2, venn3, venn4, venn5];
        const r = lookup[Math.min(lookup.length - 1, sets)];
        const f = Math.min(bb.width / r.bb.width, bb.height / r.bb.height);
        const x = f * -r.bb.x + (bb.width - f * r.bb.width) / 2 + bb.x;
        const y = f * -r.bb.y + (bb.height - f * r.bb.height) / 2 + bb.y;
        const mx = (v) => x + f * v;
        const my = (v) => y + f * v;
        return {
            sets: r.sets.map((c) => ({
                ...c,
                cx: mx(c.cx),
                cy: my(c.cy),
                text: {
                    x: mx(c.text.x),
                    y: my(c.text.y),
                },
                ...(isEllipse(c)
                    ? {
                        rx: c.rx * f,
                        ry: c.ry * f,
                    }
                    : {
                        r: c.r * f,
                    }),
            })),
            intersections: r.intersections.map((c) => ({
                text: {
                    x: mx(c.text.x),
                    y: my(c.text.y),
                },
                x1: mx(c.x1),
                y1: my(c.y1),
                sets: c.sets,
                arcs: c.arcs.map((a) => ({ ...a, x2: mx(a.x2), y2: my(a.y2) })),
            })),
        };
    }

    function patchController(type, config, controller, elements = [], scales = []) {
        chart_js.registry.addControllers(controller);
        if (Array.isArray(elements)) {
            chart_js.registry.addElements(...elements);
        }
        else {
            chart_js.registry.addElements(elements);
        }
        if (Array.isArray(scales)) {
            chart_js.registry.addScales(...scales);
        }
        else {
            chart_js.registry.addScales(scales);
        }
        const c = config;
        c.type = type;
        return c;
    }

    class VennDiagramController extends chart_js.DatasetController {
        initialize() {
            super.initialize();
            this.enableOptionSharing = true;
        }
        update(mode) {
            super.update(mode);
            const meta = this._cachedMeta;
            const slices = (meta.data || []);
            this.updateElements(slices, 0, slices.length, mode);
        }
        computeLayout(size) {
            const nSets = Math.log2(this._cachedMeta.data.length + 1);
            return layout$1(nSets, size);
        }
        updateElements(slices, start, count, mode) {
            const xScale = this._cachedMeta.xScale;
            const yScale = this._cachedMeta.yScale;
            const w = xScale.right - xScale.left;
            const h = yScale.bottom - yScale.top;
            const l = this.computeLayout({
                x: xScale.left,
                y: yScale.top,
                width: w,
                height: h,
            });
            this._cachedMeta._layout = l;
            this._cachedMeta._setLayoutFont = {
                ...xScale._resolveTickFontOptions(0),
                color: xScale.options.ticks.color,
            };
            this._cachedMeta._labelLayoutFont = {
                ...yScale._resolveTickFontOptions(0),
                color: yScale.options.ticks.color,
            };
            const firstOpts = this.resolveDataElementOptions(start, mode);
            const sharedOptions = this.getSharedOptions(firstOpts);
            const includeOptions = this.includeOptions(mode, sharedOptions);
            for (let i = start; i < start + count; i += 1) {
                const slice = slices[i];
                const properties = {
                    refs: l.sets,
                    ...l.intersections[i],
                };
                if (includeOptions) {
                    properties.options = sharedOptions || this.resolveDataElementOptions(i, mode);
                }
                this.updateElement(slice, i, properties, mode);
            }
            this.updateSharedOptions(sharedOptions, mode, firstOpts);
        }
        draw() {
            const meta = this._cachedMeta;
            const elements = meta.data;
            const { ctx } = this.chart;
            elements.forEach((elem) => elem.draw(ctx));
            this.drawLabels(ctx);
        }
        drawLabels(ctx) {
            const meta = this._cachedMeta;
            ctx.save();
            const l = meta._layout;
            const setLayoutScale = meta.xScale;
            const setLayoutFont = meta._setLayoutFont;
            const labelLayoutScale = meta.yScale;
            const labelLayoutFont = meta._labelLayoutFont;
            if (labelLayoutScale === null || labelLayoutScale === void 0 ? void 0 : labelLayoutScale.options.ticks.display) {
                ctx.font = labelLayoutFont.string;
                ctx.fillStyle = labelLayoutFont.color;
                ctx.textBaseline = 'middle';
                const labels = this.chart.data.labels;
                l.sets.forEach((set, i) => {
                    ctx.textAlign = set.align === 'middle' ? 'center' : set.align;
                    ctx.textBaseline = set.verticalAlign;
                    ctx.fillText(labels[i], set.text.x, set.text.y);
                });
            }
            if (setLayoutScale === null || setLayoutScale === void 0 ? void 0 : setLayoutScale.options.ticks.display) {
                ctx.font = setLayoutFont.string;
                ctx.fillStyle = setLayoutFont.color;
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const values = this.getDataset().data;
                l.intersections.forEach((intersection, i) => {
                    ctx.fillText(values[i].value.toLocaleString(), intersection.text.x, intersection.text.y);
                });
            }
            ctx.restore();
        }
    }
    VennDiagramController.id = 'venn';
    VennDiagramController.defaults = {
        dataElementType: ArcSlice.id,
    };
    VennDiagramController.overrides = {
        plugins: {
            tooltip: {
                callbacks: {
                    title() {
                        return '';
                    },
                    label(item) {
                        var _a, _b;
                        const labels = item.chart.data.labels;
                        const d = (_b = (_a = item.chart.data.datasets) === null || _a === void 0 ? void 0 : _a[item.datasetIndex].data) === null || _b === void 0 ? void 0 : _b[item.dataIndex];
                        return `${labels[item.dataIndex]}: ${d ? d.values || d.value.toLocaleString() : ''}`;
                    },
                },
            },
        },
        scales: {
            x: {
                type: 'linear',
                min: -1,
                max: 1,
                display: false,
            },
            y: {
                type: 'linear',
                min: -1,
                max: 1,
                display: false,
            },
        },
    };
    class VennDiagramChart extends chart_js.Chart {
        constructor(item, config) {
            super(item, patchController('venn', config, VennDiagramController, ArcSlice, [chart_js.LinearScale]));
        }
    }
    VennDiagramChart.id = VennDiagramController.id;

    const SMALL$1 = 1e-10;

    /**
     * Returns the intersection area of a bunch of circles (where each circle
     * is an object having an x,y and radius property)
     * @param {ReadonlyArray<{x: number, y: number, radius: number}>} circles
     * @param {undefined | { area?: number, arcArea?: number, polygonArea?: number, arcs?: ReadonlyArray<{ circle: {x: number, y: number, radius: number}, width: number, p1: {x: number, y: number}, p2: {x: number, y: number} }>, innerPoints: ReadonlyArray<{
        x: number;
        y: number;
        parentIndex: [number, number];
    }>, intersectionPoints: ReadonlyArray<{
      x: number;
      y: number;
      parentIndex: [number, number];
    }> }} stats
     * @returns {number}
     */
    function intersectionArea(circles, stats) {
      // get all the intersection points of the circles
      const intersectionPoints = getIntersectionPoints(circles);

      // filter out points that aren't included in all the circles
      const innerPoints = intersectionPoints.filter((p) => containedInCircles(p, circles));

      let arcArea = 0;
      let polygonArea = 0;
      /** @type {{ circle: {x: number, y: number, radius: number}, width: number, p1: {x: number, y: number}, p2: {x: number, y: number} }[]} */
      const arcs = [];

      // if we have intersection points that are within all the circles,
      // then figure out the area contained by them
      if (innerPoints.length > 1) {
        // sort the points by angle from the center of the polygon, which lets
        // us just iterate over points to get the edges
        const center = getCenter(innerPoints);
        for (let i = 0; i < innerPoints.length; ++i) {
          const p = innerPoints[i];
          p.angle = Math.atan2(p.x - center.x, p.y - center.y);
        }
        innerPoints.sort((a, b) => b.angle - a.angle);

        // iterate over all points, get arc between the points
        // and update the areas
        let p2 = innerPoints[innerPoints.length - 1];
        for (let i = 0; i < innerPoints.length; ++i) {
          const p1 = innerPoints[i];

          // polygon area updates easily ...
          polygonArea += (p2.x + p1.x) * (p1.y - p2.y);

          // updating the arc area is a little more involved
          const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          /** @types null | { circle: {x: number, y: number, radius: number}, width: number, p1: {x: number, y: number}, p2: {x: number, y: number} } */
          let arc = null;

          for (let j = 0; j < p1.parentIndex.length; ++j) {
            if (p2.parentIndex.includes(p1.parentIndex[j])) {
              // figure out the angle halfway between the two points
              // on the current circle
              const circle = circles[p1.parentIndex[j]];
              const a1 = Math.atan2(p1.x - circle.x, p1.y - circle.y);
              const a2 = Math.atan2(p2.x - circle.x, p2.y - circle.y);

              let angleDiff = a2 - a1;
              if (angleDiff < 0) {
                angleDiff += 2 * Math.PI;
              }

              // and use that angle to figure out the width of the
              // arc
              const a = a2 - angleDiff / 2;
              let width = distance(midPoint, {
                x: circle.x + circle.radius * Math.sin(a),
                y: circle.y + circle.radius * Math.cos(a),
              });

              // clamp the width to the largest is can actually be
              // (sometimes slightly overflows because of FP errors)
              if (width > circle.radius * 2) {
                width = circle.radius * 2;
              }

              // pick the circle whose arc has the smallest width
              if (arc == null || arc.width > width) {
                arc = { circle, width, p1, p2, large: width > circle.radius, sweep: true };
              }
            }
          }

          if (arc != null) {
            arcs.push(arc);
            arcArea += circleArea(arc.circle.radius, arc.width);
            p2 = p1;
          }
        }
      } else {
        // no intersection points, is either disjoint - or is completely
        // overlapped. figure out which by examining the smallest circle
        let smallest = circles[0];
        for (let i = 1; i < circles.length; ++i) {
          if (circles[i].radius < smallest.radius) {
            smallest = circles[i];
          }
        }

        // make sure the smallest circle is completely contained in all
        // the other circles
        let disjoint = false;
        for (let i = 0; i < circles.length; ++i) {
          if (distance(circles[i], smallest) > Math.abs(smallest.radius - circles[i].radius)) {
            disjoint = true;
            break;
          }
        }

        if (disjoint) {
          arcArea = polygonArea = 0;
        } else {
          arcArea = smallest.radius * smallest.radius * Math.PI;
          arcs.push({
            circle: smallest,
            p1: { x: smallest.x, y: smallest.y + smallest.radius },
            p2: { x: smallest.x - SMALL$1, y: smallest.y + smallest.radius },
            width: smallest.radius * 2,
            large: true,
            sweep: true,
          });
        }
      }

      polygonArea /= 2;

      if (stats) {
        stats.area = arcArea + polygonArea;
        stats.arcArea = arcArea;
        stats.polygonArea = polygonArea;
        stats.arcs = arcs;
        stats.innerPoints = innerPoints;
        stats.intersectionPoints = intersectionPoints;
      }

      return arcArea + polygonArea;
    }

    /**
     * returns whether a point is contained by all of a list of circles
     * @param {{x: number, y: number}} point
     * @param {ReadonlyArray<{x: number, y: number, radius: number}>} circles
     * @returns {boolean}
     */
    function containedInCircles(point, circles) {
      return circles.every((circle) => distance(point, circle) < circle.radius + SMALL$1);
    }

    /**
     * Gets all intersection points between a bunch of circles
     * @param {ReadonlyArray<{x: number, y: number, radius: number}>} circles
     * @returns {ReadonlyArray<{x: number, y: number, parentIndex: [number, number]}>}
     */
    function getIntersectionPoints(circles) {
      /** @type {{x: number, y: number, parentIndex: [number, number]}[]} */
      const ret = [];
      for (let i = 0; i < circles.length; ++i) {
        for (let j = i + 1; j < circles.length; ++j) {
          const intersect = circleCircleIntersection(circles[i], circles[j]);
          for (const p of intersect) {
            p.parentIndex = [i, j];
            ret.push(p);
          }
        }
      }
      return ret;
    }

    /**
     * Circular segment area calculation. See http://mathworld.wolfram.com/CircularSegment.html
     * @param {number} r
     * @param {number} width
     * @returns {number}
     **/
    function circleArea(r, width) {
      return r * r * Math.acos(1 - width / r) - (r - width) * Math.sqrt(width * (2 * r - width));
    }

    /**
     * euclidean distance between two points
     * @param {{x: number, y: number}} p1
     * @param {{x: number, y: number}} p2
     * @returns {number}
     **/
    function distance(p1, p2) {
      return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
    }

    /**
     * Returns the overlap area of two circles of radius r1 and r2 - that
     * have their centers separated by distance d. Simpler faster
     * circle intersection for only two circles
     * @param {number} r1
     * @param {number} r2
     * @param {number} d
     * @returns {number}
     */
    function circleOverlap(r1, r2, d) {
      // no overlap
      if (d >= r1 + r2) {
        return 0;
      }

      // completely overlapped
      if (d <= Math.abs(r1 - r2)) {
        return Math.PI * Math.min(r1, r2) * Math.min(r1, r2);
      }

      const w1 = r1 - (d * d - r2 * r2 + r1 * r1) / (2 * d);
      const w2 = r2 - (d * d - r1 * r1 + r2 * r2) / (2 * d);
      return circleArea(r1, w1) + circleArea(r2, w2);
    }

    /**
     * Given two circles (containing a x/y/radius attributes),
     * returns the intersecting points if possible
     * note: doesn't handle cases where there are infinitely many
     * intersection points (circles are equivalent):, or only one intersection point
     * @param {{x: number, y: number, radius: number}} p1
     * @param {{x: number, y: number, radius: number}} p2
     * @returns {ReadonlyArray<{x: number, y: number}>}
     **/
    function circleCircleIntersection(p1, p2) {
      const d = distance(p1, p2);
      const r1 = p1.radius;
      const r2 = p2.radius;

      // if to far away, or self contained - can't be done
      if (d >= r1 + r2 || d <= Math.abs(r1 - r2)) {
        return [];
      }

      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
      const h = Math.sqrt(r1 * r1 - a * a);
      const x0 = p1.x + (a * (p2.x - p1.x)) / d;
      const y0 = p1.y + (a * (p2.y - p1.y)) / d;
      const rx = -(p2.y - p1.y) * (h / d);
      const ry = -(p2.x - p1.x) * (h / d);

      return [
        { x: x0 + rx, y: y0 - ry },
        { x: x0 - rx, y: y0 + ry },
      ];
    }

    /**
     * Returns the center of a bunch of points
     * @param {ReadonlyArray<{x: number, y: number}>} points
     * @returns {{x: number, y: number}}
     */
    function getCenter(points) {
      const center = { x: 0, y: 0 };
      for (const point of points) {
        center.x += point.x;
        center.y += point.y;
      }
      center.x /= points.length;
      center.y /= points.length;
      return center;
    }

    /** finds the zeros of a function, given two starting points (which must
     * have opposite signs */
    function bisect(f, a, b, parameters) {
        parameters = parameters || {};
        const maxIterations = parameters.maxIterations || 100;
        const tolerance = parameters.tolerance || 1e-10;
        const fA = f(a);
        const fB = f(b);
        let delta = b - a;

        if (fA * fB > 0) {
            throw 'Initial bisect points must have opposite signs';
        }

        if (fA === 0) return a;
        if (fB === 0) return b;

        for (let i = 0; i < maxIterations; ++i) {
            delta /= 2;
            const mid = a + delta;
            const fMid = f(mid);

            if (fMid * fA >= 0) {
                a = mid;
            }

            if (Math.abs(delta) < tolerance || fMid === 0) {
                return mid;
            }
        }
        return a + delta;
    }

    // need some basic operations on vectors, rather than adding a dependency,
    // just define here
    function zeros(x) {
        const r = new Array(x);
        for (let i = 0; i < x; ++i) {
            r[i] = 0;
        }
        return r;
    }
    function zerosM(x, y) {
        return zeros(x).map(() => zeros(y));
    }

    function dot(a, b) {
        let ret = 0;
        for (let i = 0; i < a.length; ++i) {
            ret += a[i] * b[i];
        }
        return ret;
    }

    function norm2(a) {
        return Math.sqrt(dot(a, a));
    }

    function scale(ret, value, c) {
        for (let i = 0; i < value.length; ++i) {
            ret[i] = value[i] * c;
        }
    }

    function weightedSum(ret, w1, v1, w2, v2) {
        for (let j = 0; j < ret.length; ++j) {
            ret[j] = w1 * v1[j] + w2 * v2[j];
        }
    }

    /** minimizes a function using the downhill simplex method */
    function nelderMead(f, x0, parameters) {
        parameters = parameters || {};

        const maxIterations = parameters.maxIterations || x0.length * 200;
        const nonZeroDelta = parameters.nonZeroDelta || 1.05;
        const zeroDelta = parameters.zeroDelta || 0.001;
        const minErrorDelta = parameters.minErrorDelta || 1e-6;
        const minTolerance = parameters.minErrorDelta || 1e-5;
        const rho = parameters.rho !== undefined ? parameters.rho : 1;
        const chi = parameters.chi !== undefined ? parameters.chi : 2;
        const psi = parameters.psi !== undefined ? parameters.psi : -0.5;
        const sigma = parameters.sigma !== undefined ? parameters.sigma : 0.5;
        let maxDiff;

        // initialize simplex.
        const N = x0.length;
        const simplex = new Array(N + 1);
        simplex[0] = x0;
        simplex[0].fx = f(x0);
        simplex[0].id = 0;
        for (let i = 0; i < N; ++i) {
            const point = x0.slice();
            point[i] = point[i] ? point[i] * nonZeroDelta : zeroDelta;
            simplex[i + 1] = point;
            simplex[i + 1].fx = f(point);
            simplex[i + 1].id = i + 1;
        }

        function updateSimplex(value) {
            for (let i = 0; i < value.length; i++) {
                simplex[N][i] = value[i];
            }
            simplex[N].fx = value.fx;
        }

        const sortOrder = (a, b) => a.fx - b.fx;

        const centroid = x0.slice();
        const reflected = x0.slice();
        const contracted = x0.slice();
        const expanded = x0.slice();

        for (let iteration = 0; iteration < maxIterations; ++iteration) {
            simplex.sort(sortOrder);

            if (parameters.history) {
                // copy the simplex (since later iterations will mutate) and
                // sort it to have a consistent order between iterations
                const sortedSimplex = simplex.map((x) => {
                    const state = x.slice();
                    state.fx = x.fx;
                    state.id = x.id;
                    return state;
                });
                sortedSimplex.sort((a, b) => a.id - b.id);

                parameters.history.push({
                    x: simplex[0].slice(),
                    fx: simplex[0].fx,
                    simplex: sortedSimplex,
                });
            }

            maxDiff = 0;
            for (let i = 0; i < N; ++i) {
                maxDiff = Math.max(maxDiff, Math.abs(simplex[0][i] - simplex[1][i]));
            }

            if (Math.abs(simplex[0].fx - simplex[N].fx) < minErrorDelta && maxDiff < minTolerance) {
                break;
            }

            // compute the centroid of all but the worst point in the simplex
            for (let i = 0; i < N; ++i) {
                centroid[i] = 0;
                for (let j = 0; j < N; ++j) {
                    centroid[i] += simplex[j][i];
                }
                centroid[i] /= N;
            }

            // reflect the worst point past the centroid  and compute loss at reflected
            // point
            const worst = simplex[N];
            weightedSum(reflected, 1 + rho, centroid, -rho, worst);
            reflected.fx = f(reflected);

            // if the reflected point is the best seen, then possibly expand
            if (reflected.fx < simplex[0].fx) {
                weightedSum(expanded, 1 + chi, centroid, -chi, worst);
                expanded.fx = f(expanded);
                if (expanded.fx < reflected.fx) {
                    updateSimplex(expanded);
                } else {
                    updateSimplex(reflected);
                }
            }

            // if the reflected point is worse than the second worst, we need to
            // contract
            else if (reflected.fx >= simplex[N - 1].fx) {
                let shouldReduce = false;

                if (reflected.fx > worst.fx) {
                    // do an inside contraction
                    weightedSum(contracted, 1 + psi, centroid, -psi, worst);
                    contracted.fx = f(contracted);
                    if (contracted.fx < worst.fx) {
                        updateSimplex(contracted);
                    } else {
                        shouldReduce = true;
                    }
                } else {
                    // do an outside contraction
                    weightedSum(contracted, 1 - psi * rho, centroid, psi * rho, worst);
                    contracted.fx = f(contracted);
                    if (contracted.fx < reflected.fx) {
                        updateSimplex(contracted);
                    } else {
                        shouldReduce = true;
                    }
                }

                if (shouldReduce) {
                    // if we don't contract here, we're done
                    if (sigma >= 1) break;

                    // do a reduction
                    for (let i = 1; i < simplex.length; ++i) {
                        weightedSum(simplex[i], 1 - sigma, simplex[0], sigma, simplex[i]);
                        simplex[i].fx = f(simplex[i]);
                    }
                }
            } else {
                updateSimplex(reflected);
            }
        }

        simplex.sort(sortOrder);
        return { fx: simplex[0].fx, x: simplex[0] };
    }

    /// searches along line 'pk' for a point that satifies the wolfe conditions
    /// See 'Numerical Optimization' by Nocedal and Wright p59-60
    /// f : objective function
    /// pk : search direction
    /// current: object containing current gradient/loss
    /// next: output: contains next gradient/loss
    /// returns a: step size taken
    function wolfeLineSearch(f, pk, current, next, a, c1, c2) {
        const phi0 = current.fx;
        const phiPrime0 = dot(current.fxprime, pk);
        let phi = phi0;
        let phi_old = phi0;
        let phiPrime = phiPrime0;
        let a0 = 0;

        a = a || 1;
        c1 = c1 || 1e-6;
        c2 = c2 || 0.1;

        function zoom(a_lo, a_high, phi_lo) {
            for (let iteration = 0; iteration < 16; ++iteration) {
                a = (a_lo + a_high) / 2;
                weightedSum(next.x, 1.0, current.x, a, pk);
                phi = next.fx = f(next.x, next.fxprime);
                phiPrime = dot(next.fxprime, pk);

                if (phi > phi0 + c1 * a * phiPrime0 || phi >= phi_lo) {
                    a_high = a;
                } else {
                    if (Math.abs(phiPrime) <= -c2 * phiPrime0) {
                        return a;
                    }

                    if (phiPrime * (a_high - a_lo) >= 0) {
                        a_high = a_lo;
                    }

                    a_lo = a;
                    phi_lo = phi;
                }
            }

            return 0;
        }

        for (let iteration = 0; iteration < 10; ++iteration) {
            weightedSum(next.x, 1.0, current.x, a, pk);
            phi = next.fx = f(next.x, next.fxprime);
            phiPrime = dot(next.fxprime, pk);
            if (phi > phi0 + c1 * a * phiPrime0 || (iteration && phi >= phi_old)) {
                return zoom(a0, a, phi_old);
            }

            if (Math.abs(phiPrime) <= -c2 * phiPrime0) {
                return a;
            }

            if (phiPrime >= 0) {
                return zoom(a, a0, phi);
            }

            phi_old = phi;
            a0 = a;
            a *= 2;
        }

        return a;
    }

    function conjugateGradient(f, initial, params) {
        // allocate all memory up front here, keep out of the loop for perfomance
        // reasons
        let current = { x: initial.slice(), fx: 0, fxprime: initial.slice() };
        let next = { x: initial.slice(), fx: 0, fxprime: initial.slice() };
        const yk = initial.slice();
        let pk;
        let temp;
        let a = 1;
        let maxIterations;

        params = params || {};
        maxIterations = params.maxIterations || initial.length * 20;

        current.fx = f(current.x, current.fxprime);
        pk = current.fxprime.slice();
        scale(pk, current.fxprime, -1);

        for (let i = 0; i < maxIterations; ++i) {
            a = wolfeLineSearch(f, pk, current, next, a);

            // todo: history in wrong spot?
            if (params.history) {
                params.history.push({
                    x: current.x.slice(),
                    fx: current.fx,
                    fxprime: current.fxprime.slice(),
                    alpha: a,
                });
            }

            if (!a) {
                // faiiled to find point that satifies wolfe conditions.
                // reset direction for next iteration
                scale(pk, current.fxprime, -1);
            } else {
                // update direction using Polak–Ribiere CG method
                weightedSum(yk, 1, next.fxprime, -1, current.fxprime);

                const delta_k = dot(current.fxprime, current.fxprime);
                const beta_k = Math.max(0, dot(yk, next.fxprime) / delta_k);

                weightedSum(pk, beta_k, pk, -1, next.fxprime);

                temp = current;
                current = next;
                next = temp;
            }

            if (norm2(current.fxprime) <= 1e-5) {
                break;
            }
        }

        if (params.history) {
            params.history.push({
                x: current.x.slice(),
                fx: current.fx,
                fxprime: current.fxprime.slice(),
                alpha: a,
            });
        }

        return current;
    }

    /**
     * given a list of set objects, and their corresponding overlaps
     * updates the (x, y, radius) attribute on each set such that their positions
     * roughly correspond to the desired overlaps
     * @param {readonly {sets: readonly string[]; size: number; weight?: number}[]} sets
     * @returns {{[setid: string]: {x: number, y: number, radius: number}}}
     */
    function venn(sets, parameters = {}) {
      parameters.maxIterations = parameters.maxIterations || 500;

      const initialLayout = parameters.initialLayout || bestInitialLayout;
      const loss = parameters.lossFunction || lossFunction;

      // add in missing pairwise areas as having 0 size
      const areas = addMissingAreas(sets, parameters);

      // initial layout is done greedily
      const circles = initialLayout(areas, parameters);

      // transform x/y coordinates to a vector to optimize
      const setids = Object.keys(circles);
      /** @type {number[]} */
      const initial = [];
      for (const setid of setids) {
        initial.push(circles[setid].x);
        initial.push(circles[setid].y);
      }

      // optimize initial layout from our loss function
      const solution = nelderMead(
        (values) => {
          const current = {};
          for (let i = 0; i < setids.length; ++i) {
            const setid = setids[i];
            current[setid] = {
              x: values[2 * i],
              y: values[2 * i + 1],
              radius: circles[setid].radius,
              // size : circles[setid].size
            };
          }
          return loss(current, areas);
        },
        initial,
        parameters
      );

      // transform solution vector back to x/y points
      const positions = solution.x;
      for (let i = 0; i < setids.length; ++i) {
        const setid = setids[i];
        circles[setid].x = positions[2 * i];
        circles[setid].y = positions[2 * i + 1];
      }

      return circles;
    }

    const SMALL = 1e-10;

    /**
     * Returns the distance necessary for two circles of radius r1 + r2 to
     * have the overlap area 'overlap'
     * @param {number} r1
     * @param {number} r2
     * @param {number} overlap
     * @returns {number}
     */
    function distanceFromIntersectArea(r1, r2, overlap) {
      // handle complete overlapped circles
      if (Math.min(r1, r2) * Math.min(r1, r2) * Math.PI <= overlap + SMALL) {
        return Math.abs(r1 - r2);
      }

      return bisect((distance) => circleOverlap(r1, r2, distance) - overlap, 0, r1 + r2);
    }

    /**
     * Missing pair-wise intersection area data can cause problems:
     * treating as an unknown means that sets will be laid out overlapping,
     * which isn't what people expect. To reflect that we want disjoint sets
     * here, set the overlap to 0 for all missing pairwise set intersections
     * @param {ReadonlyArray<{sets: ReadonlyArray<string>, size: number}>} areas
     * @returns {ReadonlyArray<{sets: ReadonlyArray<string>, size: number}>}
     */
    function addMissingAreas(areas, parameters = {}) {
      const distinct = parameters.distinct;
      const r = areas.map((s) => Object.assign({}, s));

      function toKey(arr) {
        return arr.join(';');
      }

      if (distinct) {
        // recreate the full ones by adding things up but just to level two since the rest doesn't matter
        /** @types Map<string, number> */
        const count = new Map();
        for (const area of r) {
          for (let i = 0; i < area.sets.length; i++) {
            const si = String(area.sets[i]);
            count.set(si, area.size + (count.get(si) || 0));
            for (let j = i + 1; j < area.sets.length; j++) {
              const sj = String(area.sets[j]);
              const k1 = `${si};${sj}`;
              const k2 = `${sj};${si}`;
              count.set(k1, area.size + (count.get(k1) || 0));
              count.set(k2, area.size + (count.get(k2) || 0));
            }
          }
        }
        for (const area of r) {
          if (area.sets.length < 3) {
            area.size = count.get(toKey(area.sets));
          }
        }
      }

      // two circle intersections that aren't defined
      const ids = [];

      /** @type {Set<string>} */
      const pairs = new Set();
      for (const area of r) {
        if (area.sets.length === 1) {
          ids.push(area.sets[0]);
        } else if (area.sets.length === 2) {
          const a = area.sets[0];
          const b = area.sets[1];
          pairs.add(toKey(area.sets));
          pairs.add(toKey([b, a]));
        }
      }

      ids.sort((a, b) => (a === b ? 0 : a < b ? -1 : +1));

      for (let i = 0; i < ids.length; ++i) {
        const a = ids[i];
        for (let j = i + 1; j < ids.length; ++j) {
          const b = ids[j];
          if (!pairs.has(toKey([a, b]))) {
            r.push({ sets: [a, b], size: 0 });
          }
        }
      }
      return r;
    }

    /**
     * Returns two matrices, one of the euclidean distances between the sets
     * and the other indicating if there are subset or disjoint set relationships
     * @param {ReadonlyArray<{sets: ReadonlyArray<number>}>} areas
     * @param {ReadonlyArray<{size: number}>} sets
     * @param {ReadonlyArray<number>} setids
     */
    function getDistanceMatrices(areas, sets, setids) {
      // initialize an empty distance matrix between all the points
      /**
       * @type {number[][]}
       */
      const distances = zerosM(sets.length, sets.length);
      /**
       * @type {number[][]}
       */
      const constraints = zerosM(sets.length, sets.length);

      // compute required distances between all the sets such that
      // the areas match
      areas
        .filter((x) => x.sets.length === 2)
        .forEach((current) => {
          const left = setids[current.sets[0]];
          const right = setids[current.sets[1]];
          const r1 = Math.sqrt(sets[left].size / Math.PI);
          const r2 = Math.sqrt(sets[right].size / Math.PI);
          const distance = distanceFromIntersectArea(r1, r2, current.size);

          distances[left][right] = distances[right][left] = distance;

          // also update constraints to indicate if its a subset or disjoint
          // relationship
          let c = 0;
          if (current.size + 1e-10 >= Math.min(sets[left].size, sets[right].size)) {
            c = 1;
          } else if (current.size <= 1e-10) {
            c = -1;
          }
          constraints[left][right] = constraints[right][left] = c;
        });

      return { distances, constraints };
    }

    /// computes the gradient and loss simultaneously for our constrained MDS optimizer
    function constrainedMDSGradient(x, fxprime, distances, constraints) {
      for (let i = 0; i < fxprime.length; ++i) {
        fxprime[i] = 0;
      }

      let loss = 0;
      for (let i = 0; i < distances.length; ++i) {
        const xi = x[2 * i];
        const yi = x[2 * i + 1];
        for (let j = i + 1; j < distances.length; ++j) {
          const xj = x[2 * j];
          const yj = x[2 * j + 1];
          const dij = distances[i][j];
          const constraint = constraints[i][j];

          const squaredDistance = (xj - xi) * (xj - xi) + (yj - yi) * (yj - yi);
          const distance = Math.sqrt(squaredDistance);
          const delta = squaredDistance - dij * dij;

          if ((constraint > 0 && distance <= dij) || (constraint < 0 && distance >= dij)) {
            continue;
          }

          loss += 2 * delta * delta;

          fxprime[2 * i] += 4 * delta * (xi - xj);
          fxprime[2 * i + 1] += 4 * delta * (yi - yj);

          fxprime[2 * j] += 4 * delta * (xj - xi);
          fxprime[2 * j + 1] += 4 * delta * (yj - yi);
        }
      }
      return loss;
    }

    /**
     * takes the best working variant of either constrained MDS or greedy
     * @param {ReadonlyArray<{sets: ReadonlyArray<string>, size: number}>} areas
     */
    function bestInitialLayout(areas, params = {}) {
      let initial = greedyLayout(areas, params);
      const loss = params.lossFunction || lossFunction;

      // greedylayout is sufficient for all 2/3 circle cases. try out
      // constrained MDS for higher order problems, take its output
      // if it outperforms. (greedy is aesthetically better on 2/3 circles
      // since it axis aligns)
      if (areas.length >= 8) {
        const constrained = constrainedMDSLayout(areas, params);
        const constrainedLoss = loss(constrained, areas);
        const greedyLoss = loss(initial, areas);

        if (constrainedLoss + 1e-8 < greedyLoss) {
          initial = constrained;
        }
      }
      return initial;
    }

    /**
     * use the constrained MDS variant to generate an initial layout
     * @param {ReadonlyArray<{sets: ReadonlyArray<string>, size: number}>} areas
     * @returns {{[key: string]: {x: number, y: number, radius: number}}}
     */
    function constrainedMDSLayout(areas, params = {}) {
      const restarts = params.restarts || 10;

      // bidirectionally map sets to a rowid  (so we can create a matrix)
      const sets = [];
      const setids = {};
      for (const area of areas) {
        if (area.sets.length === 1) {
          setids[area.sets[0]] = sets.length;
          sets.push(area);
        }
      }

      let { distances, constraints } = getDistanceMatrices(areas, sets, setids);

      // keep distances bounded, things get messed up otherwise.
      // TODO: proper preconditioner?
      const norm = norm2(distances.map(norm2)) / distances.length;
      distances = distances.map((row) => row.map((value) => value / norm));

      const obj = (x, fxprime) => constrainedMDSGradient(x, fxprime, distances, constraints);

      let best = null;
      for (let i = 0; i < restarts; ++i) {
        const initial = zeros(distances.length * 2).map(Math.random);

        const current = conjugateGradient(obj, initial, params);
        if (!best || current.fx < best.fx) {
          best = current;
        }
      }

      const positions = best.x;

      // translate rows back to (x,y,radius) coordinates
      /** @type {{[key: string]: {x: number, y: number, radius: number}}} */
      const circles = {};
      for (let i = 0; i < sets.length; ++i) {
        const set = sets[i];
        circles[set.sets[0]] = {
          x: positions[2 * i] * norm,
          y: positions[2 * i + 1] * norm,
          radius: Math.sqrt(set.size / Math.PI),
        };
      }

      if (params.history) {
        for (const h of params.history) {
          scale(h.x, norm);
        }
      }
      return circles;
    }

    /**
     * Lays out a Venn diagram greedily, going from most overlapped sets to
     * least overlapped, attempting to position each new set such that the
     * overlapping areas to already positioned sets are basically right
     * @param {ReadonlyArray<{size: number, sets: ReadonlyArray<string>}>} areas
     * @return {{[key: string]: {x: number, y: number, radius: number}}}
     */
    function greedyLayout(areas, params) {
      const loss = params && params.lossFunction ? params.lossFunction : lossFunction;

      // define a circle for each set
      /** @type {{[key: string]: {x: number, y: number, radius: number}}} */
      const circles = {};
      /** @type {{[key: string]: {set: string, size: number, weight: number}[]}} */
      const setOverlaps = {};
      for (const area of areas) {
        if (area.sets.length === 1) {
          const set = area.sets[0];
          circles[set] = {
            x: 1e10,
            y: 1e10,
            rowid: circles.length,
            size: area.size,
            radius: Math.sqrt(area.size / Math.PI),
          };
          setOverlaps[set] = [];
        }
      }

      areas = areas.filter((a) => a.sets.length === 2);

      // map each set to a list of all the other sets that overlap it
      for (const current of areas) {
        let weight = current.weight != null ? current.weight : 1.0;
        const left = current.sets[0];
        const right = current.sets[1];

        // completely overlapped circles shouldn't be positioned early here
        if (current.size + SMALL >= Math.min(circles[left].size, circles[right].size)) {
          weight = 0;
        }

        setOverlaps[left].push({ set: right, size: current.size, weight });
        setOverlaps[right].push({ set: left, size: current.size, weight });
      }

      // get list of most overlapped sets
      const mostOverlapped = [];
      Object.keys(setOverlaps).forEach((set) => {
        let size = 0;
        for (let i = 0; i < setOverlaps[set].length; ++i) {
          size += setOverlaps[set][i].size * setOverlaps[set][i].weight;
        }

        mostOverlapped.push({ set, size });
      });

      // sort by size desc
      function sortOrder(a, b) {
        return b.size - a.size;
      }
      mostOverlapped.sort(sortOrder);

      // keep track of what sets have been laid out
      const positioned = {};
      function isPositioned(element) {
        return element.set in positioned;
      }

      /**
       * adds a point to the output
       * @param {{x: number, y: number}} point
       * @param {number} index
       */
      function positionSet(point, index) {
        circles[index].x = point.x;
        circles[index].y = point.y;
        positioned[index] = true;
      }

      // add most overlapped set at (0,0)
      positionSet({ x: 0, y: 0 }, mostOverlapped[0].set);

      // get distances between all points. TODO, necessary?
      // answer: probably not
      // var distances = venn.getDistanceMatrices(circles, areas).distances;
      for (let i = 1; i < mostOverlapped.length; ++i) {
        const setIndex = mostOverlapped[i].set;
        const overlap = setOverlaps[setIndex].filter(isPositioned);
        const set = circles[setIndex];
        overlap.sort(sortOrder);

        if (overlap.length === 0) {
          // this shouldn't happen anymore with addMissingAreas
          throw 'ERROR: missing pairwise overlap information';
        }

        /** @type {{x: number, y: number}[]} */
        const points = [];
        for (var j = 0; j < overlap.length; ++j) {
          // get appropriate distance from most overlapped already added set
          const p1 = circles[overlap[j].set];
          const d1 = distanceFromIntersectArea(set.radius, p1.radius, overlap[j].size);

          // sample positions at 90 degrees for maximum aesthetics
          points.push({ x: p1.x + d1, y: p1.y });
          points.push({ x: p1.x - d1, y: p1.y });
          points.push({ y: p1.y + d1, x: p1.x });
          points.push({ y: p1.y - d1, x: p1.x });

          // if we have at least 2 overlaps, then figure out where the
          // set should be positioned analytically and try those too
          for (let k = j + 1; k < overlap.length; ++k) {
            const p2 = circles[overlap[k].set];
            const d2 = distanceFromIntersectArea(set.radius, p2.radius, overlap[k].size);

            const extraPoints = circleCircleIntersection(
              { x: p1.x, y: p1.y, radius: d1 },
              { x: p2.x, y: p2.y, radius: d2 }
            );
            points.push(...extraPoints);
          }
        }

        // we have some candidate positions for the set, examine loss
        // at each position to figure out where to put it at
        let bestLoss = 1e50;
        let bestPoint = points[0];
        for (const point of points) {
          circles[setIndex].x = point.x;
          circles[setIndex].y = point.y;
          const localLoss = loss(circles, areas);
          if (localLoss < bestLoss) {
            bestLoss = localLoss;
            bestPoint = point;
          }
        }

        positionSet(bestPoint, setIndex);
      }

      return circles;
    }

    /**
     * Given a bunch of sets, and the desired overlaps between these sets - computes
     * the distance from the actual overlaps to the desired overlaps. Note that
     * this method ignores overlaps of more than 2 circles
     * @param {{[key: string]: <{x: number, y: number, radius: number}>}} circles
     * @param {ReadonlyArray<{size: number, sets: ReadonlyArray<string>, weight?: number}>} overlaps
     * @returns {number}
     */
    function lossFunction(circles, overlaps) {
      let output = 0;

      for (const area of overlaps) {
        if (area.sets.length === 1) {
          continue;
        }
        /** @type {number} */
        let overlap;
        if (area.sets.length === 2) {
          const left = circles[area.sets[0]];
          const right = circles[area.sets[1]];
          overlap = circleOverlap(left.radius, right.radius, distance(left, right));
        } else {
          overlap = intersectionArea(area.sets.map((d) => circles[d]));
        }

        const weight = area.weight != null ? area.weight : 1.0;
        output += weight * (overlap - area.size) * (overlap - area.size);
      }

      return output;
    }

    function logRatioLossFunction(circles, overlaps) {
      let output = 0;

      for (const area of overlaps) {
        if (area.sets.length === 1) {
          continue;
        }
        /** @type {number} */
        let overlap;
        if (area.sets.length === 2) {
          const left = circles[area.sets[0]];
          const right = circles[area.sets[1]];
          overlap = circleOverlap(left.radius, right.radius, distance(left, right));
        } else {
          overlap = intersectionArea(area.sets.map((d) => circles[d]));
        }

        const weight = area.weight != null ? area.weight : 1.0;
        const differenceFromIdeal = Math.log((overlap + 1) / (area.size + 1));
        output += weight * differenceFromIdeal * differenceFromIdeal;
      }

      return output;
    }

    /**
     * orientates a bunch of circles to point in orientation
     * @param {{x :number, y: number, radius: number}[]} circles
     * @param {number | undefined} orientation
     * @param {((a: {x :number, y: number, radius: number}, b: {x :number, y: number, radius: number}) => number) | undefined} orientationOrder
     */
    function orientateCircles(circles, orientation, orientationOrder) {
      if (orientationOrder == null) {
        circles.sort((a, b) => b.radius - a.radius);
      } else {
        circles.sort(orientationOrder);
      }

      // shift circles so largest circle is at (0, 0)
      if (circles.length > 0) {
        const largestX = circles[0].x;
        const largestY = circles[0].y;

        for (const circle of circles) {
          circle.x -= largestX;
          circle.y -= largestY;
        }
      }

      if (circles.length === 2) {
        // if the second circle is a subset of the first, arrange so that
        // it is off to one side. hack for https://github.com/benfred/venn.js/issues/120
        const dist = distance(circles[0], circles[1]);
        if (dist < Math.abs(circles[1].radius - circles[0].radius)) {
          circles[1].x = circles[0].x + circles[0].radius - circles[1].radius - 1e-10;
          circles[1].y = circles[0].y;
        }
      }

      // rotate circles so that second largest is at an angle of 'orientation'
      // from largest
      if (circles.length > 1) {
        const rotation = Math.atan2(circles[1].x, circles[1].y) - orientation;
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);

        for (const circle of circles) {
          const x = circle.x;
          const y = circle.y;
          circle.x = c * x - s * y;
          circle.y = s * x + c * y;
        }
      }

      // mirror solution if third solution is above plane specified by
      // first two circles
      if (circles.length > 2) {
        let angle = Math.atan2(circles[2].x, circles[2].y) - orientation;
        while (angle < 0) {
          angle += 2 * Math.PI;
        }
        while (angle > 2 * Math.PI) {
          angle -= 2 * Math.PI;
        }
        if (angle > Math.PI) {
          const slope = circles[1].y / (1e-10 + circles[1].x);
          for (const circle of circles) {
            var d = (circle.x + slope * circle.y) / (1 + slope * slope);
            circle.x = 2 * d - circle.x;
            circle.y = 2 * d * slope - circle.y;
          }
        }
      }
    }

    /**
     *
     * @param {ReadonlyArray<{x: number, y: number, radius: number}>} circles
     * @returns {{x: number, y: number, radius: number}[][]}
     */
    function disjointCluster(circles) {
      // union-find clustering to get disjoint sets
      circles.forEach((circle) => {
        circle.parent = circle;
      });

      // path compression step in union find
      function find(circle) {
        if (circle.parent !== circle) {
          circle.parent = find(circle.parent);
        }
        return circle.parent;
      }

      function union(x, y) {
        const xRoot = find(x);
        const yRoot = find(y);
        xRoot.parent = yRoot;
      }

      // get the union of all overlapping sets
      for (let i = 0; i < circles.length; ++i) {
        for (let j = i + 1; j < circles.length; ++j) {
          const maxDistance = circles[i].radius + circles[j].radius;
          if (distance(circles[i], circles[j]) + 1e-10 < maxDistance) {
            union(circles[j], circles[i]);
          }
        }
      }

      // find all the disjoint clusters and group them together
      /** @type {Map<string, {x: number, y: number, radius: number}[]>} */
      const disjointClusters = new Map();
      for (let i = 0; i < circles.length; ++i) {
        const setid = find(circles[i]).parent.setid;
        if (!disjointClusters.has(setid)) {
          disjointClusters.set(setid, []);
        }
        disjointClusters.get(setid).push(circles[i]);
      }

      // cleanup bookkeeping
      circles.forEach((circle) => {
        delete circle.parent;
      });

      // return in more usable form
      return Array.from(disjointClusters.values());
    }

    /**
     * @param {ReadonlyArray<{x :number, y: number, radius: number}>} circles
     * @returns {{xRange: [number, number], yRange: [number, number]}}
     */
    function getBoundingBox(circles) {
      const minMax = (d) => {
        const hi = circles.reduce((acc, c) => Math.max(acc, c[d] + c.radius), Number.NEGATIVE_INFINITY);
        const lo = circles.reduce((acc, c) => Math.min(acc, c[d] - c.radius), Number.POSITIVE_INFINITY);
        return { max: hi, min: lo };
      };
      return { xRange: minMax('x'), yRange: minMax('y') };
    }

    /**
     *
     * @param {{[setid: string]: {x: number, y: number, radius: number}}} solution
     * @param {undefined | number} orientation
     * @param {((a: {x :number, y: number, radius: number}, b: {x :number, y: number, radius: number}) => number) | undefined} orientationOrder
     * @returns {{[setid: string]: {x: number, y: number, radius: number}}}
     */
    function normalizeSolution(solution, orientation, orientationOrder) {
      if (orientation == null) {
        orientation = Math.PI / 2;
      }

      // work with a list instead of a dictionary, and take a copy so we
      // don't mutate input
      let circles = fromObjectNotation(solution).map((d) => Object.assign({}, d));

      // get all the disjoint clusters
      const clusters = disjointCluster(circles);

      // orientate all disjoint sets, get sizes
      for (const cluster of clusters) {
        orientateCircles(cluster, orientation, orientationOrder);
        const bounds = getBoundingBox(cluster);
        cluster.size = (bounds.xRange.max - bounds.xRange.min) * (bounds.yRange.max - bounds.yRange.min);
        cluster.bounds = bounds;
      }
      clusters.sort((a, b) => b.size - a.size);

      // orientate the largest at 0,0, and get the bounds
      circles = clusters[0];
      let returnBounds = circles.bounds;
      const spacing = (returnBounds.xRange.max - returnBounds.xRange.min) / 50;

      /**
       * @param {ReadonlyArray<{x: number, y: number, radius: number, setid: string}>} cluster
       * @param {boolean} right
       * @param {boolean} bottom
       */
      function addCluster(cluster, right, bottom) {
        if (!cluster) {
          return;
        }

        const bounds = cluster.bounds;
        /** @type {number} */
        let xOffset;
        /** @type {number} */
        let yOffset;

        if (right) {
          xOffset = returnBounds.xRange.max - bounds.xRange.min + spacing;
        } else {
          xOffset = returnBounds.xRange.max - bounds.xRange.max;
          const centreing =
            (bounds.xRange.max - bounds.xRange.min) / 2 - (returnBounds.xRange.max - returnBounds.xRange.min) / 2;
          if (centreing < 0) {
            xOffset += centreing;
          }
        }

        if (bottom) {
          yOffset = returnBounds.yRange.max - bounds.yRange.min + spacing;
        } else {
          yOffset = returnBounds.yRange.max - bounds.yRange.max;
          const centreing =
            (bounds.yRange.max - bounds.yRange.min) / 2 - (returnBounds.yRange.max - returnBounds.yRange.min) / 2;
          if (centreing < 0) {
            yOffset += centreing;
          }
        }

        for (const c of cluster) {
          c.x += xOffset;
          c.y += yOffset;
          circles.push(c);
        }
      }

      let index = 1;
      while (index < clusters.length) {
        addCluster(clusters[index], true, false);
        addCluster(clusters[index + 1], false, true);
        addCluster(clusters[index + 2], true, true);
        index += 3;

        // have one cluster (in top left). lay out next three relative
        // to it in a grid
        returnBounds = getBoundingBox(circles);
      }

      // convert back to solution form
      return toObjectNotation(circles);
    }

    /**
     * Scales a solution from venn.venn or venn.greedyLayout such that it fits in
     * a rectangle of width/height - with padding around the borders. also
     * centers the diagram in the available space at the same time.
     * If the scale parameter is not null, this automatic scaling is ignored in favor of this custom one
     * @param {{[setid: string]: {x: number, y: number, radius: number}}} solution
     * @param {number} width
     * @param {number} height
     * @param {number} padding
     * @param {boolean} scaleToFit
     * @returns {{[setid: string]: {x: number, y: number, radius: number}}}
     */
    function scaleSolution(solution, width, height, padding, scaleToFit) {
      const circles = fromObjectNotation(solution);

      width -= 2 * padding;
      height -= 2 * padding;

      const { xRange, yRange } = getBoundingBox(circles);

      if (xRange.max === xRange.min || yRange.max === yRange.min) {
        console.log('not scaling solution: zero size detected');
        return solution;
      }

      /** @type {number} */
      let xScaling;
      /** @type {number} */
      let yScaling;
      if (scaleToFit) {
        const toScaleDiameter = Math.sqrt(scaleToFit / Math.PI) * 2;
        xScaling = width / toScaleDiameter;
        yScaling = height / toScaleDiameter;
      } else {
        xScaling = width / (xRange.max - xRange.min);
        yScaling = height / (yRange.max - yRange.min);
      }

      const scaling = Math.min(yScaling, xScaling);
      // while we're at it, center the diagram too
      const xOffset = (width - (xRange.max - xRange.min) * scaling) / 2;
      const yOffset = (height - (yRange.max - yRange.min) * scaling) / 2;

      return toObjectNotation(
        circles.map((circle) => ({
          radius: scaling * circle.radius,
          x: padding + xOffset + (circle.x - xRange.min) * scaling,
          y: padding + yOffset + (circle.y - yRange.min) * scaling,
          setid: circle.setid,
        }))
      );
    }

    /**
     * @param {readonly {x: number, y: number, radius: number, setid: string}[]} circles
     * @returns {{[setid: string]: {x: number, y: number, radius: number, setid: string}}}
     */
    function toObjectNotation(circles) {
      /** @type {{[setid: string]: {x: number, y: number, radius: number, setid: string}}} */
      const r = {};
      for (const circle of circles) {
        r[circle.setid] = circle;
      }
      return r;
    }
    /**
     * @param {{[setid: string]: {x: number, y: number, radius: number}}} solution
     * @returns {{x: number, y: number, radius: number, setid: string}[]}}
     */
    function fromObjectNotation(solution) {
      const setids = Object.keys(solution);
      return setids.map((id) => Object.assign(solution[id], { setid: id }));
    }

    /**
     *
     * @param {{x: number, y: number}} current
     * @param {ReadonlyArray<{x: number, y: number}>} interior
     * @param {ReadonlyArray<{x: number, y: number}>} exterior
     * @returns {number}
     */
    function circleMargin(current, interior, exterior) {
      let margin = interior[0].radius - distance(interior[0], current);

      for (let i = 1; i < interior.length; ++i) {
        const m = interior[i].radius - distance(interior[i], current);
        if (m <= margin) {
          margin = m;
        }
      }

      for (let i = 0; i < exterior.length; ++i) {
        const m = distance(exterior[i], current) - exterior[i].radius;
        if (m <= margin) {
          margin = m;
        }
      }
      return margin;
    }

    /**
     * compute the center of some circles by maximizing the margin of
     * the center point relative to the circles (interior) after subtracting
     * nearby circles (exterior)
     * @param {readonly {x: number, y: number, radius: number}[]} interior
     * @param {readonly {x: number, y: number, radius: number}[]} exterior
     * @param {boolean} symmetricalTextCentre
     * @returns {{x:number, y: number}}
     */
    function computeTextCentre(interior, exterior, symmetricalTextCentre) {
      // get an initial estimate by sampling around the interior circles
      // and taking the point with the biggest margin
      /** @type {{x: number, y: number}[]} */
      const points = [];
      for (const c of interior) {
        points.push({ x: c.x, y: c.y });
        points.push({ x: c.x + c.radius / 2, y: c.y });
        points.push({ x: c.x - c.radius / 2, y: c.y });
        points.push({ x: c.x, y: c.y + c.radius / 2 });
        points.push({ x: c.x, y: c.y - c.radius / 2 });
      }

      let initial = points[0];
      let margin = circleMargin(points[0], interior, exterior);

      for (let i = 1; i < points.length; ++i) {
        const m = circleMargin(points[i], interior, exterior);
        if (m >= margin) {
          initial = points[i];
          margin = m;
        }
      }

      // maximize the margin numerically
      const solution = nelderMead(
        (p) => -1 * circleMargin({ x: p[0], y: p[1] }, interior, exterior),
        [initial.x, initial.y],
        { maxIterations: 500, minErrorDelta: 1e-10 }
      ).x;

      const ret = { x: symmetricalTextCentre ? 0 : solution[0], y: solution[1] };

      // check solution, fallback as needed (happens if fully overlapped
      // etc)
      let valid = true;
      for (const i of interior) {
        if (distance(ret, i) > i.radius) {
          valid = false;
          break;
        }
      }

      for (const e of exterior) {
        if (distance(ret, e) < e.radius) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return ret;
      }

      if (interior.length == 1) {
        return { x: interior[0].x, y: interior[0].y };
      }
      const areaStats = {};
      intersectionArea(interior, areaStats);

      if (areaStats.arcs.length === 0) {
        return { x: 0, y: -1000, disjoint: true };
      }
      if (areaStats.arcs.length == 1) {
        return { x: areaStats.arcs[0].circle.x, y: areaStats.arcs[0].circle.y };
      }
      if (exterior.length) {
        // try again without other circles
        return computeTextCentre(interior, []);
      }
      // take average of all the points in the intersection
      // polygon. this should basically never happen
      // and has some issues:
      // https://github.com/benfred/venn.js/issues/48#issuecomment-146069777
      return getCenter(areaStats.arcs.map((a) => a.p1));
    }

    // given a dictionary of {setid : circle}, returns
    // a dictionary of setid to list of circles that completely overlap it
    function getOverlappingCircles(circles) {
      const ret = {};
      const circleids = Object.keys(circles);
      for (const circleid of circleids) {
        ret[circleid] = [];
      }
      for (let i = 0; i < circleids.length; i++) {
        const ci = circleids[i];
        const a = circles[ci];
        for (let j = i + 1; j < circleids.length; ++j) {
          const cj = circleids[j];
          const b = circles[cj];
          const d = distance(a, b);

          if (d + b.radius <= a.radius + 1e-10) {
            ret[cj].push(ci);
          } else if (d + a.radius <= b.radius + 1e-10) {
            ret[ci].push(cj);
          }
        }
      }
      return ret;
    }

    function computeTextCentres(circles, areas, symmetricalTextCentre) {
      const ret = {};
      const overlapped = getOverlappingCircles(circles);
      for (let i = 0; i < areas.length; ++i) {
        const area = areas[i].sets;
        const areaids = {};
        const exclude = {};

        for (let j = 0; j < area.length; ++j) {
          areaids[area[j]] = true;
          const overlaps = overlapped[area[j]];
          // keep track of any circles that overlap this area,
          // and don't consider for purposes of computing the text
          // centre
          for (let k = 0; k < overlaps.length; ++k) {
            exclude[overlaps[k]] = true;
          }
        }

        const interior = [];
        const exterior = [];
        for (let setid in circles) {
          if (setid in areaids) {
            interior.push(circles[setid]);
          } else if (!(setid in exclude)) {
            exterior.push(circles[setid]);
          }
        }
        const centre = computeTextCentre(interior, exterior, symmetricalTextCentre);
        ret[area] = centre;
        if (centre.disjoint && areas[i].size > 0) {
          console.log('WARNING: area ' + area + ' not represented on screen');
        }
      }
      return ret;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @returns {string}
     */
    function circlePath(x, y, r) {
      const ret = [];
      ret.push('\nM', x, y);
      ret.push('\nm', -r, 0);
      ret.push('\na', r, r, 0, 1, 0, r * 2, 0);
      ret.push('\na', r, r, 0, 1, 0, -r * 2, 0);
      return ret.join(' ');
    }

    function intersectionAreaArcs(circles) {
      if (circles.length === 0) {
        return [];
      }
      const stats = {};
      intersectionArea(circles, stats);
      return stats.arcs;
    }

    function arcsToPath(arcs, round) {
      if (arcs.length === 0) {
        return 'M 0 0';
      }
      const rFactor = Math.pow(10, round || 0);
      const r = round != null ? (v) => Math.round(v * rFactor) / rFactor : (v) => v;
      if (arcs.length == 1) {
        const circle = arcs[0].circle;
        return circlePath(r(circle.x), r(circle.y), r(circle.radius));
      }
      // draw path around arcs
      const ret = ['\nM', r(arcs[0].p2.x), r(arcs[0].p2.y)];
      for (const arc of arcs) {
        const radius = r(arc.circle.radius);
        ret.push('\nA', radius, radius, 0, arc.large ? 1 : 0, arc.sweep ? 1 : 0, r(arc.p1.x), r(arc.p1.y));
      }
      return ret.join(' ');
    }

    function layout(data, options = {}) {
      const {
        lossFunction: loss,
        layoutFunction: layout = venn,
        normalize = true,
        orientation = Math.PI / 2,
        orientationOrder,
        width = 600,
        height = 350,
        padding = 15,
        scaleToFit = false,
        symmetricalTextCentre = false,
        distinct,
        round = 2,
      } = options;

      let solution = layout(data, {
        lossFunction: loss === 'default' || !loss ? lossFunction : loss === 'logRatio' ? logRatioLossFunction : loss,
        distinct,
      });

      if (normalize) {
        solution = normalizeSolution(solution, orientation, orientationOrder);
      }

      const circles = scaleSolution(solution, width, height, padding, scaleToFit);
      const textCentres = computeTextCentres(circles, data, symmetricalTextCentre);

      const circleLookup = new Map(
        Object.keys(circles).map((set) => [
          set,
          {
            set,
            x: circles[set].x,
            y: circles[set].y,
            radius: circles[set].radius,
          },
        ])
      );
      const helpers = data.map((area) => {
        const circles = area.sets.map((s) => circleLookup.get(s));
        const arcs = intersectionAreaArcs(circles);
        const path = arcsToPath(arcs, round);
        return { circles, arcs, path, area, has: new Set(area.sets) };
      });

      function genDistinctPath(sets) {
        let r = '';
        for (const e of helpers) {
          if (e.has.size > sets.length && sets.every((s) => e.has.has(s))) {
            r += ' ' + e.path;
          }
        }
        return r;
      }

      return helpers.map(({ circles, arcs, path, area }) => {
        return {
          data: area,
          text: textCentres[area.sets],
          circles,
          arcs,
          path,
          distinctPath: path + genDistinctPath(area.sets),
        };
      });
    }

    function center(circles) {
        const sumX = circles.reduce((acc, a) => acc + a.x, 0);
        const sumY = circles.reduce((acc, a) => acc + a.y, 0);
        return {
            x: sumX / circles.length,
            y: sumY / circles.length,
        };
    }
    function shiftPath(path, x, y) {
        if (!path) {
            return path;
        }
        const mapX = (v) => x(Number.parseFloat(v)).toString();
        const mapY = (v) => y(Number.parseFloat(v)).toString();
        const transformedPath = path
            .split('\n')
            .map((line) => {
            const parts = line.trim().split(/[ ,]/);
            if (parts[0] === 'M') {
                return `${parts[0]} ${mapX(parts[1])} ${mapY(parts[2])}`;
            }
            if (parts[0] === 'A') {
                return `${parts.slice(0, 6).join(' ')} ${mapX(parts[6])} ${mapY(parts[7])}`;
            }
            return line;
        })
            .join('\n');
        return transformedPath;
    }
    function angleAtCircle(p, c) {
        const x = p.x - c.x;
        const y = p.y - c.y;
        return (Math.atan2(y, x) / Math.PI) * 180;
    }
    function euler(sets, bb) {
        const r = layout(sets.map((s) => ({ sets: s.sets, size: s.value })), {
            width: bb.width,
            height: bb.height,
            distinct: true,
        });
        const singleSets = r.filter((d) => d.data.sets.length === 1);
        const setNames = singleSets.map((d) => d.data.sets[0]);
        const setCircles = singleSets.map((d) => d.circles[0]);
        const eulerCenter = center(singleSets.map((d) => d.circles[0]));
        const setData = singleSets.map((d) => {
            const c = d.circles[0];
            const angle = angleAtCircle(c, eulerCenter);
            return {
                cx: c.x + bb.x,
                cy: c.y + bb.y,
                r: c.radius,
                align: angle > 90 ? 'end' : 'start',
                verticalAlign: 'bottom',
                text: pointAtCircle(c.x + bb.x, c.y + bb.y, c.radius * 1.1, angle),
            };
        });
        const asArc = (a) => ({
            x2: a.p1.x + bb.x,
            y2: a.p1.y + bb.y,
            ref: setCircles.findIndex((d) => Math.abs(d.x - a.circle.x) < 0.05 && Math.abs(d.y - a.circle.y) < 0.05),
            sweep: true,
            large: a.width > a.circle.radius,
            mode: 'i',
        });
        return {
            sets: setData,
            intersections: r.map((d) => {
                const { arcs } = d;
                const text = {
                    x: d.text.x + bb.x,
                    y: d.text.y + bb.y,
                };
                const subSets = d.data.sets.map((subSet) => setNames.indexOf(subSet));
                if (arcs.length === 0) {
                    return {
                        sets: subSets,
                        text,
                        x1: 0,
                        y1: 0,
                        arcs: [],
                    };
                }
                if (arcs.length === 1) {
                    const c = d.arcs[0].circle;
                    return {
                        sets: subSets,
                        text,
                        x1: d.arcs[0].p2.x + bb.x,
                        y1: c.y - c.radius + bb.y,
                        arcs: [asArc(d.arcs[0]), Object.assign(asArc(d.arcs[0]), { y2: c.y - c.radius + bb.y })],
                        path: shiftPath(d.distinctPath || d.path, (x) => x + bb.x, (y) => y + bb.y),
                    };
                }
                return {
                    text,
                    sets: subSets,
                    x1: d.arcs[0].p2.x + bb.x,
                    y1: d.arcs[0].p2.y + bb.y,
                    arcs: d.arcs.map((e) => asArc(e)),
                    path: shiftPath(d.distinctPath || d.path, (x) => x + bb.x, (y) => y + bb.y),
                };
            }),
        };
    }

    class EulerDiagramController extends VennDiagramController {
        computeLayout(size) {
            const sets = this._data;
            return euler(sets, size);
        }
    }
    EulerDiagramController.id = 'euler';
    EulerDiagramController.defaults = VennDiagramController.defaults;
    class EulerDiagramChart extends chart_js.Chart {
        constructor(item, config) {
            super(item, patchController('euler', config, EulerDiagramController, ArcSlice));
        }
    }
    EulerDiagramChart.id = EulerDiagramController.id;

    function generateSubset(members, notMembers, lookup) {
        const sets = members.map((s) => s.label);
        const label = sets.join(' ∩ ');
        const others = members.slice(1).map((s) => lookup.get(s));
        const not = notMembers.map((s) => lookup.get(s));
        const values = members[0].values.filter((v) => others.every((o) => o != null && o.has(v)) && not.every((o) => o != null && !o.has(v)));
        return {
            sets,
            label,
            value: values.length,
            values,
            degree: sets.length,
        };
    }
    function extractSets(data, options = {}) {
        const sets = [];
        const lookup = new Map(data.map((s) => [s, new Set(s.values)]));
        const base = data.slice(0, 5);
        switch (base.length) {
            case 1:
                sets.push(generateSubset([base[0]], [], lookup));
                break;
            case 2:
                sets.push(generateSubset([base[0]], [base[1]], lookup), generateSubset([base[1]], [base[0]], lookup), generateSubset([base[0], base[1]], [], lookup));
                break;
            case 3:
                sets.push(generateSubset([base[0]], [base[1], base[2]], lookup), generateSubset([base[1]], [base[0], base[2]], lookup), generateSubset([base[2]], [base[0], base[1]], lookup), generateSubset([base[0], base[1]], [base[2]], lookup), generateSubset([base[0], base[2]], [base[1]], lookup), generateSubset([base[1], base[2]], [base[0]], lookup), generateSubset([base[0], base[1], base[2]], [], lookup));
                break;
            case 4:
                sets.push(generateSubset([base[0]], [base[1], base[2], base[3]], lookup), generateSubset([base[1]], [base[0], base[2], base[3]], lookup), generateSubset([base[2]], [base[0], base[1], base[3]], lookup), generateSubset([base[3]], [base[0], base[1], base[2]], lookup), generateSubset([base[0], base[1]], [base[2], base[3]], lookup), generateSubset([base[0], base[2]], [base[1], base[3]], lookup), generateSubset([base[0], base[3]], [base[1], base[2]], lookup), generateSubset([base[1], base[2]], [base[0], base[3]], lookup), generateSubset([base[1], base[3]], [base[0], base[2]], lookup), generateSubset([base[2], base[3]], [base[0], base[1]], lookup), generateSubset([base[0], base[1], base[2]], [base[3]], lookup), generateSubset([base[0], base[1], base[3]], [base[2]], lookup), generateSubset([base[0], base[2], base[3]], [base[1]], lookup), generateSubset([base[1], base[2], base[3]], [base[0]], lookup), generateSubset([base[0], base[1], base[2], base[3]], [], lookup));
                break;
            case 5:
                sets.push(generateSubset([base[0]], [base[1], base[2], base[3], base[4]], lookup), generateSubset([base[1]], [base[0], base[2], base[3], base[4]], lookup), generateSubset([base[2]], [base[0], base[1], base[3], base[4]], lookup), generateSubset([base[3]], [base[0], base[1], base[2], base[4]], lookup), generateSubset([base[4]], [base[0], base[1], base[2], base[3]], lookup), generateSubset([base[0], base[1]], [base[2], base[3], base[4]], lookup), generateSubset([base[0], base[2]], [base[1], base[3], base[4]], lookup), generateSubset([base[0], base[3]], [base[1], base[2], base[4]], lookup), generateSubset([base[0], base[4]], [base[1], base[2], base[3]], lookup), generateSubset([base[1], base[2]], [base[0], base[3], base[4]], lookup), generateSubset([base[1], base[3]], [base[0], base[2], base[4]], lookup), generateSubset([base[1], base[4]], [base[0], base[2], base[3]], lookup), generateSubset([base[2], base[3]], [base[0], base[1], base[4]], lookup), generateSubset([base[2], base[4]], [base[0], base[1], base[3]], lookup), generateSubset([base[3], base[4]], [base[0], base[1], base[2]], lookup), generateSubset([base[0], base[1], base[2]], [base[3], base[4]], lookup), generateSubset([base[0], base[1], base[3]], [base[2], base[4]], lookup), generateSubset([base[0], base[1], base[4]], [base[2], base[3]], lookup), generateSubset([base[0], base[2], base[3]], [base[1], base[4]], lookup), generateSubset([base[0], base[2], base[4]], [base[1], base[3]], lookup), generateSubset([base[0], base[3], base[4]], [base[1], base[2]], lookup), generateSubset([base[1], base[2], base[3]], [base[0], base[4]], lookup), generateSubset([base[1], base[2], base[4]], [base[0], base[3]], lookup), generateSubset([base[1], base[3], base[4]], [base[0], base[2]], lookup), generateSubset([base[2], base[3], base[4]], [base[0], base[1]], lookup), generateSubset([base[0], base[1], base[2], base[3]], [base[4]], lookup), generateSubset([base[0], base[1], base[2], base[4]], [base[3]], lookup), generateSubset([base[0], base[1], base[3], base[4]], [base[2]], lookup), generateSubset([base[0], base[2], base[3], base[4]], [base[1]], lookup), generateSubset([base[1], base[2], base[3], base[4]], [base[0]], lookup), generateSubset([base[0], base[1], base[2], base[3], base[4]], [], lookup));
                break;
        }
        return {
            labels: sets.map((s) => s.label),
            datasets: [
                {
                    label: options.label || 'Venn Diagram',
                    data: sets,
                },
            ],
        };
    }

    chart_js.registry.addControllers(VennDiagramController, EulerDiagramController);
    chart_js.registry.addElements(ArcSlice);

    exports.ArcSlice = ArcSlice;
    exports.EulerDiagramChart = EulerDiagramChart;
    exports.EulerDiagramController = EulerDiagramController;
    exports.VennDiagramChart = VennDiagramChart;
    exports.VennDiagramController = VennDiagramController;
    exports.extractSets = extractSets;

}));
//# sourceMappingURL=index.umd.js.map
