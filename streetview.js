var streetView;

(function () {
    var gl, pl, program;
    var bgBuffer, bgIndexBuffer, bgTextureCoordBuffer;
    var vertexPositionAttribute, vertexTextureAttribute;
    var texture;

    function initBuffers () {
        var sphere = getSphere(50);

        bgBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.vertex), gl.STATIC_DRAW);
        bgBuffer.itemSize = 3;
        bgBuffer.numItems = sphere.vertex.length / 3;

        bgIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bgIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphere.index), gl.STATIC_DRAW);
        bgIndexBuffer.itemSize = 3;
        bgIndexBuffer.numItems = sphere.index.length;

        bgTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bgTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.texture), gl.STATIC_DRAW);
        bgTextureCoordBuffer.itemSize = 2;
        bgTextureCoordBuffer.numItems = sphere.texture.index / 2;
    }

    function initShader () {
        var vertexShader = createShaderFromScriptElement(gl, 'panoshader-v');
        var fragShader = createShaderFromScriptElement(gl, 'panoshader-f');
        program = createProgram(gl, [vertexShader, fragShader]);

        vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        vertexTextureAttribute = gl.getAttribLocation(program, 'aTextureCoord');
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

        gl.enableVertexAttribArray(vertexPositionAttribute);
        gl.enableVertexAttribArray(vertexTextureAttribute);

        pl.prepareDraw();

        gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, bgBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bgTextureCoordBuffer);
        gl.vertexAttribPointer(vertexTextureAttribute, bgTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(program, 'uSampler'), 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bgIndexBuffer);
        gl.drawElements(gl.TRIANGLES, bgIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(vertexPositionAttribute);
        gl.disableVertexAttribArray(vertexTextureAttribute);
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