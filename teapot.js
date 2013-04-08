var teapot;

(function () {
    var gl, pl, program, shadowProgram;
    var vertexBuffer, vertexIndexBuffer, normalBuffer;
    var vertexPositionAttribute, vertexNormalAttribute;
    var shadowPositionAttribute;
    var texture, reflectionTexture, bumpMapTexture;
    var textureImage, bumpMapImage;
    var maxBrightness, averageBrightness;

    var lightPMatrix, lightMVMatrix;

    function initBuffers () {
        var obj = loadObjFile('models/teapot.obj');
        normals = computeNormals(obj.vertices, obj.faces);
        console.log(obj);

        // Vertex buffer
        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.vertices), gl.STATIC_DRAW);
        vertexBuffer.itemSize = 3;
        vertexBuffer.numItems = obj.vertices.length / 3;

        // Vertex index (faces) buffer
        vertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(obj.faces), gl.STATIC_DRAW);
        vertexIndexBuffer.itemSize = 3;
        vertexIndexBuffer.numItems = obj.faces.length / 3;

        // Normal vectors buffer
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        normalBuffer.itemSize = 3;
        normalBuffer.numItems = normals.length / 3;
    }

    function initShader () {
        var vertexShader = createShaderFromScriptElement(gl, 'potshader-v');
        var fragmentShader = createShaderFromScriptElement(gl, 'potshader-f');
        program = createProgram(gl, [vertexShader, fragmentShader]);

        vertexShader = createShaderFromScriptElement(gl, 'shadowshader-v');
        fragmentShader = createShaderFromScriptElement(gl, 'shadowshader-f');
        shadowProgram = createProgram(gl, [vertexShader, fragmentShader]);

        shadowPositionAttribute = gl.getAttribLocation(shadowProgram, 'aPosition');
        vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        vertexNormalAttribute = gl.getAttribLocation(program, 'aVertexNormal');
    }

    function initTexture () {
        reflectionTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, reflectionTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // clamp to edge gives us non-power-of-2 support
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        textureImage = new Image();
        textureImage.addEventListener('load', function () {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
        });

        bumpMapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, bumpMapTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        bumpMapImage = new Image();
        bumpMapImage.addEventListener('load', function () {
            gl.bindTexture(gl.TEXTURE_2D, bumpMapTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bumpMapImage);
        });
    }

    function init (_gl, _pl) {
        gl = _gl;
        pl = _pl;

        initBuffers();
        initShader();
        initTexture();
    }

    function drawShadow (modelRotation, uniforms) {
        gl.useProgram(shadowProgram);
        pl.shader = shadowProgram;

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        gl.enableVertexAttribArray(shadowPositionAttribute);
        pl.rotate(modelRotation, [0, 1, 0]);

        // For teapot
        pl.scale([0.5, 0.65, 0.5]);
        pl.translate([0.0, -1.5, 0.0]);

        // Hook up the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(shadowPositionAttribute, vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

        pl.prepareDraw();
        pl.setUniforms(uniforms);

        lightPMatrix = pl.pMatrix.flatten();
        lightMVMatrix = pl.modelView.flatten();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
        gl.drawElements(gl.TRIANGLES, vertexIndexBuffer.numItems * vertexIndexBuffer.itemSize, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disable(gl.CULL_FACE);

        gl.disableVertexAttribArray(shadowPositionAttribute);
    }

    function draw (modelRotation, yaw, pitch, shadowTexture, uniforms) {
        gl.useProgram(program);
        pl.shader = program;
        gl.enableVertexAttribArray(vertexNormalAttribute);
        gl.enableVertexAttribArray(vertexPositionAttribute);

        pl.rotate(modelRotation, [0, 1, 0]);

        // For teapot
        pl.scale([0.5, 0.65, 0.5]);
        pl.translate([0.0, -1.5, 0.0]);

        // Hook up the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.vertexAttribPointer(vertexNormalAttribute, normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // Set up textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, reflectionTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'uReflectionSampler'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(program, 'uTextureSampler'), 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, bumpMapTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'uBumpMapSampler'), 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'uShadowMapSampler'), 3);

        var lightProj = gl.getUniformLocation(program, 'lightProj');
        gl.uniformMatrix4fv(lightProj, false, new Float32Array(lightPMatrix));

        var lightView = gl.getUniformLocation(program, 'lightView');
        gl.uniformMatrix4fv(lightView, false, new Float32Array(lightMVMatrix));

        pl.prepareDraw();

        uniforms.maxBrightness = maxBrightness;
        uniforms.averageBrightness = averageBrightness;
        pl.setUniforms(uniforms);

        var rotUniform = gl.getUniformLocation(program, 'uRotations');
        gl.uniform2fv(rotUniform, [yaw, pitch]);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
        gl.drawElements(gl.TRIANGLES, vertexIndexBuffer.numItems * vertexIndexBuffer.itemSize, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(vertexNormalAttribute);
        gl.disableVertexAttribArray(vertexPositionAttribute);
    }

    function setReflectionCanvas (canvas) {
        gl.bindTexture(gl.TEXTURE_2D, reflectionTexture);
        var context = canvas.getContext('2d');
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        var data = context.getImageData(0, 0, canvas.width, canvas.height);
        maxBrightness = 0;
        var totalBrightness = 0;
        for (var x = 0, width = data.width; x < width; x++) {
            for (var y = 0, height = data.height; y < height; y++) {
                var i = (y * width + x) * 4;
                // Note that this ignores the alpha value
                var brightness = (data.data[i] + data.data[i+1] + data.data[i+2]) / (255 * 3);
                if (brightness > maxBrightness) {
                    maxBrightness = brightness;
                }
                totalBrightness += brightness;
            }
        }
        averageBrightness = totalBrightness / (data.width * data.height);
    }

    teapot = {
        init: init,
        draw: draw,
        drawShadow: drawShadow,
        setReflectionCanvas: setReflectionCanvas,
        set texture(url) { textureImage.src = url; },
        set bumpMap(url) { bumpMapImage.src = url; }
    };

})();
