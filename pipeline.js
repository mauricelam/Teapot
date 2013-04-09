/*jshint es5:true */

/**
 * ModelView matrix and Perspective matrices. Mostly stuff that were built in to standard OpenGL.
 */
var Pipeline;
(function () {
    var gl, mvMatrix, pMatrix, invMatrix, shader;
    var matrixStack = [];

    /**
     * Equivalent to gluPerspective.
     */
    function perspective() {
        pMatrix = glUtils.perspective.apply(this, Array.prototype.slice.call(arguments));
        return pMatrix;
    }

    /**
     * Similar to gluLookAt, but instead of specifying the lookAt direction, it specifies the lookat
     * point.
     */
    function lookAt(eye, center, up) {
        var mat = glUtils.lookat(eye[0], eye[1], eye[2], center[0], center[1], center[2], up[0], up[1], up[2]);
        multMatrix(mat);
    }

    /**
     * Equivalent to glLoadIdentity.
     */
    function loadIdentity () {
        mvMatrix = Matrix.I(4);
        invMatrix = Matrix.I(4);
    }
    
    /**
     * Equivalent to glMultMatrix, with the additional optional parameter that is the inverse of m.
     * Providing an inverse will 1) save the time for computing the inverse, and 2) mitigate the
     * loss in precision caused by numerical errors in computing the inverse.
     */
    function multMatrix (m, inverse) {
        mvMatrix = mvMatrix.x(m);
        inverse = inverse || m.inverse(); // in case the user did not provide an inverse
        invMatrix = inverse.x(invMatrix);
    }

    /**
     * Simiar to glTranslate, but takes in an array instead of 3 doubles.
     */
    function translate (v) {
        multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4(),
            Matrix.Translation($V([-v[0], -v[1], -v[2]])).ensure4x4());
    }

    /**
     * Similar to glScale, but takes in an array instead of 3 doubles.
     */
    function scale (s) {
        multMatrix($M([
            [s[0], 0, 0, 0],
            [0, s[1], 0, 0],
            [0, 0, s[2], 0],
            [0, 0,    0, 1]
        ]),
        $M([
            [1/s[0], 0, 0, 0],
            [0, 1/s[1], 0, 0],
            [0, 0, 1/s[2], 0],
            [0, 0,      0, 1]
        ]));
    }

    /**
     * Tells the pipeline you are about to draw vertices. Sets the associated matrices into shader
     * uniforms.
     */
    function prepareDraw () {
        var pUniform = gl.getUniformLocation(shader, 'uPMatrix');
        gl.uniformMatrix4fv(pUniform, false, new Float32Array(pMatrix.flatten()));

        var mvUniform = gl.getUniformLocation(shader, 'uMVMatrix');
        gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));

        var nUniform = gl.getUniformLocation(shader, 'uNormalMatrix');
        gl.uniformMatrix4fv(nUniform, false, new Float32Array(invMatrix.transpose().flatten()));
    }

    /**
     * Similar to glPushMatrix. Always pushes the modelView matrix.
     */
    function pushMatrix () {
        matrixStack.push([mvMatrix.dup(), invMatrix.dup()]);
    }

    /**
     * Similar to glPopMatrix. Always pops from the modelView matrix stack.
     */
    function popMatrix () {
        if (!matrixStack.length)
            throw("Can't pop from an empty matrix stack.");

        var matrices = matrixStack.pop();
        mvMatrix = matrices[0];
        invMatrix = matrices[1];
        return mvMatrix;
    }

    /**
     * Similar to glRotate. Takes an array instead of 3 floats for the rotation axis.
     */
    function rotate (angle, v) {
        var inRadians = angle * Math.PI / 180.0;

        var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
        multMatrix(m, m.transpose());
    }

    /**
     * Sets the uniforms specified in the `uniforms` object. Only supports floats, float vectors
     * and float matrices. The name of the uniform will be prefixed with 'u'.
     *
     * Example:
     *     setUniforms({
     *        lightViewMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
     *        viewVector: [0,0,-1],
     *        shininess: 16
     *     });
     *
     *     -- shader --
     *     uniform mat4 uLightViewMatrix;
     *     uniform vec3 uViewVector;
     *     uniform float uShininess;
     *
     * Note: For matrices, the transpose argument is always false.
     */
    function setUniforms (uniforms) {
        for (var i in uniforms) {
            var varName = 'u' + i.charAt(0).toUpperCase() + i.slice(1);
            var location = gl.getUniformLocation(shader, varName);
            var value = uniforms[i];
            if (typeof value === 'number' || typeof value === 'string') {
                gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                if (value.length > 4) {
                    gl['uniformMatrix' + Math.sqrt(value.length) + 'fv'](location, false, value);
                } else {
                    gl['uniform' + value.length + 'fv'](location, value);
                }
            } else {
                throw 'Unsupported uniform type';
            }
        }
    }

    /**
     * Similar idea to setUniforms, sets all the textures automatically in the given object.
     * Uniforms of this type if prefixed with 's' (for sampler). The start parameter specifies the
     * start of the texture id to use, which it will use contiguously after that value. For example,
     * if the start is 5 and there are 3 textures, textures 5, 6, 7 will be used.
     */
    function setTextures (textures, start) {
        var id = start || 0;
        for (var i in textures) {
            var varName = 's' + i.charAt(0).toUpperCase() + i.slice(1);
            gl.activeTexture(gl['TEXTURE' + id]);
            gl.bindTexture(gl.TEXTURE_2D, textures[i]);
            gl.uniform1i(gl.getUniformLocation(shader, varName), id);
            id++;
        }
    }

    // functions and values to export
    Pipeline = {
        perspective: perspective,
        lookAt: lookAt,
        loadIdentity: loadIdentity,
        multMatrix: multMatrix,
        translate: translate,
        prepareDraw: prepareDraw,
        pushMatrix: pushMatrix,
        popMatrix: popMatrix,
        rotate: rotate,
        scale: scale,
        setUniforms: setUniforms,
        setTextures: setTextures,
        set gl (_gl) { gl = _gl; },
        get gl () { return gl; },
        set shader (_shader) { shader = _shader; },
        get shader () { return shader; },
        get modelView () { return mvMatrix; },
        get pMatrix() { return pMatrix; },
        get normalMatrix () { return invMatrix.transpose(); }
    };

})();