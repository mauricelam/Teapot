/**
 * Renders the street view environment sphere in the background. Rendered as a "perfect" sphere with
 * the street view texture mapped onto it. Also used for Google+ photosphere environment mapping.
 */

var streetView;

(function () {
    // The structure of this file is similar to teapot.js so I won't add too much comments here.
    var gl, pl, program;
    var buffers = {}, attributes = {};
    var texture;

    function initBuffers () {
        var sphere = getSphere(50);

        buffers.vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.vertex), gl.STATIC_DRAW);
        buffers.vertices.itemSize = 3;
        buffers.vertices.numItems = sphere.vertex.length / 3;

        buffers.indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphere.index), gl.STATIC_DRAW);
        buffers.indices.itemSize = 3;
        buffers.indices.numItems = sphere.index.length;

        buffers.textureCoords = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoords);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.texture), gl.STATIC_DRAW);
        buffers.textureCoords.itemSize = 2;
        buffers.textureCoords.numItems = sphere.texture.index / 2;
    }

    function initShader () {
        var vertexShader = createShaderFromScriptElement(gl, 'panoshader-v');
        var fragShader = createShaderFromScriptElement(gl, 'panoshader-f');
        program = createProgram(gl, [vertexShader, fragShader]);

        attributes.positions = gl.getAttribLocation(program, 'aVertexPosition');
        attributes.textureCoords = gl.getAttribLocation(program, 'aTextureCoord');
    }

    function initTexture () {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    function init (_gl, _pl) {
        gl = _gl;
        pl = _pl;

        initBuffers();
        initShader();
        initTexture();
    }

    function draw () {
        gl.useProgram(program);
        pl.shader = program;

        gl.enableVertexAttribArray(attributes.positions);
        gl.enableVertexAttribArray(attributes.textureCoords);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.vertexAttribPointer(attributes.positions, buffers.vertices.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoords);
        gl.vertexAttribPointer(attributes.textureCoords, buffers.textureCoords.itemSize, gl.FLOAT, false, 0, 0);

        pl.setTextures({ sTexture: texture }, 0);
        pl.prepareDraw();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.drawElements(gl.TRIANGLES, buffers.indices.numItems, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(attributes.positions);
        gl.disableVertexAttribArray(attributes.textureCoords);
    }

    function setCanvas (canvas) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }

    streetView = {
        init: init,
        draw: draw,
        setCanvas: setCanvas
    };

})();