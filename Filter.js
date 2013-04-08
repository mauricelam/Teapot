var Filter = function (gl, size, filter) {
    this.size = size;
    this.output = gl.createTexture();
    this.gl = gl;
    gl.bindTexture(gl.TEXTURE_2D, this.output);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.output, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    var vertexShader = loadShader(gl, 'precision mediump float;varying vec2 texcoord;attribute vec2 position;void main(){texcoord = position*0.5+0.5;gl_Position = vec4(position, 0.0, 1.0);}', gl.VERTEX_SHADER);
    var fragmentShader = loadShader(gl, 'precision mediump float;varying vec2 texcoord;uniform vec2 viewport;uniform sampler2D source;vec3 get(float x, float y){vec2 off = vec2(x, y);return texture2D(source, texcoord+off/viewport).rgb;}vec3 get(int x, int y){vec2 off = vec2(x, y);return texture2D(source, texcoord+off/viewport).rgb;}vec3 filter(){' + filter + '}void main(){gl_FragColor = vec4(filter(), 1.0);}', gl.FRAGMENT_SHADER);
    this.shader = createProgram(gl, [vertexShader, fragmentShader]);
    this.shader.positionAttribute = gl.getAttribLocation(this.shader, 'position');
};

Filter.prototype.apply = function (source) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.useProgram(this.shader);
    gl.viewport(0, 0, this.size, this.size);
    // gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2fv(gl.getUniformLocation(this.shader, 'viewport'), [this.size, this.size]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(this.shader, 'source'), 0);

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var vertices = [
        1.0, 1.0, 0.0,
        -1.0, 1.0, 0.0,
        1.0, -1.0, 0.0,
        -1.0, -1.0, 0.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(this.shader.positionAttribute);
    gl.vertexAttribPointer(this.shader.positionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(this.shader.positionAttribute);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};