/**
 * This file is responsible for the teapot. Includes the teapot's own shader program, 
 */

var teapot;

(function () {
    var gl, pl, program, shadowProgram;
    var buffers = {}, attributes = {}, textures = {};
    var textureImage, bumpMapImage;
    var maxBrightness, averageBrightness;

    var lightPMatrix, lightMVMatrix;

    function initBuffers () {
        var obj = loadObjFile('teapot.obj');
        normals = computeNormals(obj.vertices, obj.faces);

        // Vertex buffer
        buffers.vertex = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.vertices), gl.STATIC_DRAW);
        buffers.vertex.itemSize = 3;
        buffers.vertex.numItems = obj.vertices.length / 3;

        // Vertex index (faces) buffer
        buffers.indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(obj.faces), gl.STATIC_DRAW);
        buffers.indices.itemSize = 3;
        buffers.indices.numItems = obj.faces.length / 3;

        // Normal vectors buffer
        buffers.normals = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        buffers.normals.itemSize = 3;
        buffers.normals.numItems = normals.length / 3;
    }

    function initShader () {
        var vertexShader = createShaderFromScriptElement(gl, 'potshader-v');
        var fragmentShader = createShaderFromScriptElement(gl, 'potshader-f');
        program = createProgram(gl, [vertexShader, fragmentShader]);

        vertexShader = createShaderFromScriptElement(gl, 'shadowshader-v');
        fragmentShader = createShaderFromScriptElement(gl, 'shadowshader-f');
        shadowProgram = createProgram(gl, [vertexShader, fragmentShader]);

        attributes.shadowPositions = gl.getAttribLocation(shadowProgram, 'aPosition');
        attributes.positions = gl.getAttribLocation(program, 'aVertexPosition');
        attributes.normals = gl.getAttribLocation(program, 'aVertexNormal');
    }

    function initTexture () {
        // Texture of the environment
        textures.reflection = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures.reflection);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // clamp to edge gives us non-power-of-2 support
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Texture on the teapot itself
        textures.teapot = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures.teapot);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        textureImage = new Image();
        textureImage.addEventListener('load', function () {
            gl.bindTexture(gl.TEXTURE_2D, textures.teapot);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
        });

        // Texture of the bump map
        textures.bumpMap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures.bumpMap);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        bumpMapImage = new Image();
        bumpMapImage.addEventListener('load', function () {
            gl.bindTexture(gl.TEXTURE_2D, textures.bumpMap);
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

        gl.clearColor(1, 1, 1, 1);

        gl.enableVertexAttribArray(attributes.shadowPositions);
        pl.rotate(modelRotation, [0, 1, 0]);

        // For teapot
        pl.scale(0.5, 0.65, 0.5);
        pl.translate(0.0, -1.5, 0.0);

        // Hook up the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
        gl.vertexAttribPointer(attributes.shadowPositions, buffers.vertex.itemSize, gl.FLOAT, false, 0, 0);

        pl.prepareDraw();
        pl.setUniforms(uniforms);

        lightPMatrix = pl.pMatrix.flatten();
        lightMVMatrix = pl.modelView.flatten();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.drawElements(gl.TRIANGLES, buffers.indices.numItems * buffers.indices.itemSize, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(attributes.shadowPositions);
    }

    function draw (modelRotation, yawPitch, shadowTexture, uniforms) {
        gl.useProgram(program);
        pl.shader = program;
        gl.enableVertexAttribArray(attributes.normals);
        gl.enableVertexAttribArray(attributes.positions);

        pl.rotate(modelRotation, [0, 1, 0]);

        // For teapot
        pl.scale(0.5, 0.65, 0.5);
        pl.translate(0.0, -1.5, 0.0);

        // Hook up the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
        gl.vertexAttribPointer(attributes.positions, buffers.vertex.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.vertexAttribPointer(attributes.normals, buffers.normals.itemSize, gl.FLOAT, false, 0, 0);

        // Set up textures
        var shaderTextures = {
            sReflection: textures.reflection,
            sTexture: textures.teapot,
            sBumpMap: textures.bumpMap,
            sShadowMap: shadowTexture
        };
        pl.setTextures(shaderTextures, 0);

        pl.prepareDraw();

        uniforms.uLightProj = lightPMatrix;
        uniforms.uLightView = lightMVMatrix;
        uniforms.uMaxBrightness = maxBrightness;
        uniforms.uAverageBrightness = averageBrightness;
        pl.setUniforms(uniforms);

        var rotUniform = gl.getUniformLocation(program, 'uRotations');
        gl.uniform2fv(rotUniform, yawPitch);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.drawElements(gl.TRIANGLES, buffers.indices.numItems * buffers.indices.itemSize, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(attributes.normals);
        gl.disableVertexAttribArray(attributes.positions);
    }

    /**
     * Sets the reflection texture by passing in a canvas that contains the image. This function
     * puts the image in but also calculates the maximum and average brightness for lighting.
     */
    function setReflectionCanvas (canvas) {
        gl.bindTexture(gl.TEXTURE_2D, textures.reflection);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

        // Calculate max and average brightness
        var context = canvas.getContext('2d');
        var data = context.getImageData(0, 0, canvas.width, canvas.height);
        maxBrightness = 0;
        var totalBrightness = 0;
        for (var x = 0, width = data.width; x < width; x++) {
            for (var y = 0, height = data.height; y < height; y++) {
                var i = (y * width + x) * 4;
                // Note that this ignores the alpha value
                var brightness = (data.data[i] + data.data[i+1] + data.data[i+2]) / (255 * 3);
                maxBrightness = Math.max(maxBrightness, brightness);
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
