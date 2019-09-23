//@ts-check
import Mouse from './mouse.js';

class Main {
    static async init() {
        /**
         * @type {HTMLCanvasElement}
         */
        //@ts-ignore
        const canvas = document.getElementById('unko');
        this.canvas = canvas;
        canvas.width = 512;
        canvas.height = 512;

        this.mouse = new Mouse(canvas);
        this.po = document.getElementById('po');

        const gl = canvas.getContext('webgl');
        this.gl = gl;

        const program = gl.createProgram();
        this.program = program;
        const loadVert = fetch('./src/shader/v.vert');
        const loadFrag = fetch('./src/shader/f.frag');
        await Promise.all([loadVert, loadFrag])
            .then(([vert, frag]) => Promise.all([vert.text(), frag.text()]))
            .then((sources) => {
                for (let i = 0; i < 2; i++) {
                    const shader = gl.createShader([gl.VERTEX_SHADER, gl.FRAGMENT_SHADER][i]);
                    gl.shaderSource(shader, sources[i]);
                    gl.compileShader(shader);
                    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                        console.warn(gl.getShaderInfoLog(shader));
                        throw new Error(['vertex', 'fragment'][i] + ' shader error');
                    }
                    gl.attachShader(program, shader);
                }
            });
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn(gl.getProgramInfoLog(program));
            throw new Error('link error');
        }
        gl.useProgram(program);

        /**
         * 
         * @param {Array<number>} data 
         */
        const createVbo = (data) => {
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            return vbo;
        }

        const pos = [
            -1, 1,
            1, 1,
            -1, -1,
            1, -1
        ];
        const vPos = createVbo(pos);
        const vPosL = gl.getAttribLocation(program, 'pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, vPos);
        gl.enableVertexAttribArray(vPosL);
        gl.vertexAttribPointer(vPosL, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        const index = [
            0, 2, 3,
            3, 1, 0,
        ];
        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

        this.uTime = gl.getUniformLocation(program, 'time');
        this.uResolution = gl.getUniformLocation(program, 'resolution');
        this.uMouse = gl.getUniformLocation(program, 'mouse');

        this.timeStart = Date.now();
    }
    static update() {
        this.mouse.update();
    }
    static draw() {
        const canvas = this.canvas;
        const gl = this.gl;
        const m = this.mouse;

        gl.uniform1f(this.uTime, (Date.now() - this.timeStart) / 1000);
        gl.uniform2f(this.uResolution, canvas.width, canvas.height);
        gl.uniform2f(this.uMouse, m.x/canvas.width, 1-m.y/canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.flush();
    }
    static async run() {
        await this.init();
        const loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
            //setTimeout(loop, 3000 / 60);
        }
        loop();
    }
}

Main.run();