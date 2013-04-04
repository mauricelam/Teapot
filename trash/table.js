var teapot;

(function () {
    var gl, pl, program;
    var vertexBuffer, vertexIndexBuffer, normalBuffer;
    var vertexPositionAttribute, vertexNormalAttribute;
    var texture, reflectionTexture, bumpMapTexture;
    var textureImage, bumpMapImage;
    var maxBrightness, averageBrightness, lightVector;

    function initBuffers () {
        var obj = loadObjFile('models/coffee.obj');
        normals = computeNormals(obj.vertices, obj.faces);

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
        var vertexShader = createShaderFromScriptElement(gl, 'tableshader-v');
        var fragmentShader = createShaderFromScriptElement(gl, 'tableshader-f');
        program = createProgram(gl, [vertexShader, fragmentShader]);

        vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        gl.enableVertexAttribArray(vertexPositionAttribute);

        vertexNormalAttribute = gl.getAttribLocation(program, 'aVertexNormal');
        gl.enableVertexAttribArray(vertexNormalAttribute);
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
        textureImage.src = 'textures/wood.jpg';

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
        bumpMapImage.src = 'textures/wood.jpg';
    }

    function init (_gl, _pl) {
        gl = _gl;
        pl = _pl;

        initBuffers();
        initShader();
        initTexture();
    }

    function draw (yaw, pitch, uniforms) {
        gl.useProgram(program);
        pl.shader = program;

        pl.translate([0, -4.8, 0]);
        // pl.scale([0.0006, 0.0006, 0.0006]);

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

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);

        pl.prepareDraw();

        uniforms.maxBrightness = maxBrightness;
        uniforms.averageBrightness = averageBrightness;
        uniforms.lightVector = [0.5, 2.0, 0.5];
        for (var i in uniforms) {
            var varName = 'u' + i.charAt(0).toUpperCase() + i.slice(1);
            var location = gl.getUniformLocation(program, varName);
            var value = uniforms[i];
            if (typeof value === 'number' || typeof value === 'string') {
                gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                gl['uniform' + value.length + 'fv'](location, value);
            } else {
                throw 'Unsupported uniform type for ' + i;
            }
        }

        var rotUniform = gl.getUniformLocation(program, 'uRotations');
        gl.uniform2fv(rotUniform, [yaw, pitch]);

        gl.drawElements(gl.TRIANGLES, vertexIndexBuffer.numItems * vertexIndexBuffer.itemSize, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
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

    table = {
        init: init,
        draw: draw,
        setReflectionCanvas: setReflectionCanvas,
        // set texture(url) { textureImage.src = url; },
        // set bumpMap(url) { bumpMapImage.src = url; }
    };

})();
