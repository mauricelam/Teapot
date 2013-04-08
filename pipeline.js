/*jshint es5:true */

/**
 * Extended the example functions given in mozilla webGL tutorial to be a working default pipeline.
 * 
 * Reference: https://developer.mozilla.org/en-US/docs/WebGL/Adding_2D_content_to_a_WebGL_context
 */
var Pipeline;
(function () {
    var gl, mvMatrix, pMatrix, invMatrix, shader;
    var matrixStack = [];

    function perspective() {
        pMatrix = makePerspective.apply(this, Array.prototype.slice.call(arguments));
        return pMatrix;
    }

    function lookAt(eye, center, up) {
        var mat = makeLookAt(eye[0], eye[1], eye[2], center[0], center[1], center[2], up[0], up[1], up[2]);
        multMatrix(mat);
    }

    function loadIdentity () {
        mvMatrix = Matrix.I(4);
        invMatrix = Matrix.I(4);
    }
    
    // Providing an inverse will 1) save the time for computing the inverse, and 2) mitigate the
    // loss in precision caused by instability of computing the inverse.
    function multMatrix (m, inverse) {
        mvMatrix = mvMatrix.x(m);
        inverse = inverse || m.inverse(); // in case the user did not provide an inverse
        invMatrix = inverse.x(invMatrix);
    }

    function translate (v) {
        multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4(),
            Matrix.Translation($V([-v[0], -v[1], -v[2]])).ensure4x4());
    }

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

    function prepareDraw () {
        var pUniform = gl.getUniformLocation(shader, 'uPMatrix');
        gl.uniformMatrix4fv(pUniform, false, new Float32Array(pMatrix.flatten()));

        var mvUniform = gl.getUniformLocation(shader, 'uMVMatrix');
        gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));

        var nUniform = gl.getUniformLocation(shader, 'uNormalMatrix');
        gl.uniformMatrix4fv(nUniform, false, new Float32Array(invMatrix.transpose().flatten()));
    }

    function pushMatrix () {
        matrixStack.push([mvMatrix.dup(), invMatrix.dup()]);
    }

    function popMatrix () {
        if (!matrixStack.length) {
            throw("Can't pop from an empty matrix stack.");
        }

        var matrices = matrixStack.pop();
        mvMatrix = matrices[0];
        invMatrix = matrices[1];
        return mvMatrix;
    }

    function rotate (angle, v) {
        var inRadians = angle * Math.PI / 180.0;

        var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
        multMatrix(m, m.transpose());
    }

    function setUniforms (uniforms) {
        for (var i in uniforms) {
            var varName = 'u' + i.charAt(0).toUpperCase() + i.slice(1);
            var location = gl.getUniformLocation(shader, varName);
            var value = uniforms[i];
            if (typeof value === 'number' || typeof value === 'string') {
                gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                gl['uniform' + value.length + 'fv'](location, value);
            } else {
                throw 'Unsupported uniform type';
            }
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
        set gl (_gl) { gl = _gl; },
        get gl () { return gl; },
        set shader (_shader) { shader = _shader; },
        get shader () { return shader; },
        get modelView () { return mvMatrix; },
        get pMatrix() { return pMatrix; },
        get normalMatrix () { return invMatrix.transpose(); }
    };

})();