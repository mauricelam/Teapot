#extension GL_OES_standard_derivatives : enable

precision mediump float;

varying vec3 vVertexPosition;
uniform mat4 uMVMatrix, uPMatrix;

void main(void) {
    // VSM shadow mapping 
    // http://codeflow.org/entries/2013/feb/15/soft-shadow-mapping/
    vec4 pos = uPMatrix * uMVMatrix * vec4(vVertexPosition, 1.0);
    float depth = clamp(length(pos)/7.0, 0.0, 1.0);
    float dx = dFdx(depth);
    float dy = dFdy(depth);
    gl_FragColor = vec4(depth, pow(depth, 2.0) + 0.25 * (dx*dx + dy*dy), 0.0, 1.0);
}